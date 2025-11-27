import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { MedusaError } from "@medusajs/framework/utils"

type ApplyDiscountRequest = {
  promotion_codes?: string[]
  discount_amount?: number
  discount_percentage?: number
  reason?: string
}

export async function POST(
  req: MedusaRequest<ApplyDiscountRequest>,
  res: MedusaResponse
): Promise<void> {
  const { id: orderId } = req.params
  const { promotion_codes, discount_amount, discount_percentage, reason } = req.body

  const orderModuleService = req.scope.resolve("order")

  try {
    // Get the current order with calculated totals
    // Note: Must explicitly request total fields - they're not stored in DB
    const order = await orderModuleService.retrieveOrder(orderId, {
      relations: ["items"],
      select: ["id", "status", "total", "currency_code", "payment_collection_id"],
    })

    if (!order) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Order with id ${orderId} not found`
      )
    }

    // Check if order can be edited
    if (order.status === "canceled") {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Cannot apply discount to a canceled order"
      )
    }

    // Get total from order (calculated field)
    const originalTotal = order.total ? (typeof order.total === 'number' ? order.total : parseFloat(String(order.total))) : 0

    // Calculate discount amount
    let totalDiscount = 0
    if (discount_amount) {
      totalDiscount = discount_amount
    } else if (discount_percentage) {
      totalDiscount = (originalTotal * discount_percentage) / 100
    }

    if (!totalDiscount || totalDiscount <= 0) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Discount amount must be greater than 0"
      )
    }

    // Calculate discount per item
    const itemsCount = order.items?.length || 0
    const discountPerItem = totalDiscount / itemsCount

    // Create adjustments for each item with unique codes
    const timestamp = Date.now()
    const adjustments = []
    for (const item of order.items || []) {
      // Generate unique code for each discount application
      const uniqueCode = promotion_codes?.[0] || `DISCOUNT_${timestamp}`
      
      try {
        const adjustment = await orderModuleService.createOrderLineItemAdjustments(orderId, [{
          item_id: item.id,
          amount: discountPerItem,
          description: reason || "Retroactive discount",
          code: uniqueCode,
        }])
        adjustments.push(...adjustment)
      } catch (adjError: any) {
        console.error("Error creating adjustment for item:", item.id, adjError)
        throw adjError
      }
    }

    console.log("All adjustments created:", adjustments.length)

    // Get the updated order with adjustments to calculate refund amount
    const updatedOrder = await orderModuleService.retrieveOrder(orderId, {
      relations: ["items.adjustments"],
      select: ["id", "total", "currency_code"],
    })

    const newTotal = updatedOrder.total ? (typeof updatedOrder.total === 'number' ? updatedOrder.total : parseFloat(String(updatedOrder.total))) : 0
    
    // Get payment info and summary using query
    let paidAmount = 0
    
    try {
      const query = req.scope.resolve("query")
      const { data: [orderWithSummary] } = await query.graph({
        entity: "order",
        fields: ["id", "summary.*"],
        filters: { id: orderId },
      })
      
      if (orderWithSummary?.summary) {
        const summary = orderWithSummary.summary
        paidAmount = summary.paid_total ? (typeof summary.paid_total === 'number' ? summary.paid_total : parseFloat(String(summary.paid_total))) : 0
        
        console.log("📊 Order Summary after adjustments:", {
          paid_total: summary.paid_total,
          current_order_total: summary.current_order_total,
          pending_difference: summary.pending_difference,
          order_total_calculated: newTotal,
          refund_needed: paidAmount - newTotal
        })
      }
      
      // If no payment yet, use original total as baseline
      if (paidAmount === 0) {
        paidAmount = originalTotal
      }
    } catch (paymentError) {
      console.error("Could not retrieve payment summary:", paymentError.message)
      // Fallback: assume paid amount equals original total
      paidAmount = originalTotal
    }

    const refundAmount = paidAmount - newTotal

    // Log the discount application as order metadata for activity tracking
    try {
      const currentMetadata = (order as any).metadata || {}
      const discountHistory = Array.isArray(currentMetadata.discount_history) 
        ? currentMetadata.discount_history 
        : []
      
      discountHistory.push({
        discount_amount: totalDiscount,
        original_total: originalTotal,
        new_total: newTotal,
        reason: reason || "Retroactive discount applied",
        code: `DISCOUNT_${timestamp}`,
        applied_by: (req as any).auth_context?.actor_id || "admin",
        applied_at: new Date().toISOString(),
        refund_required: refundAmount > 0,
        refund_amount: refundAmount > 0 ? refundAmount : 0,
      })

      await orderModuleService.updateOrders(orderId, {
        metadata: {
          ...currentMetadata,
          discount_history: discountHistory,
          last_discount_applied: new Date().toISOString(),
        },
      })
    } catch (metadataError) {
      console.error("Failed to update discount history metadata:", metadataError)
      // Don't fail the request if metadata update fails
    }

    res.json({
      order_edit: {
        id: orderId,
        order_id: orderId,
        original_total: originalTotal,
        discount_amount: totalDiscount,
      },
      original_total: originalTotal,
      new_total: newTotal,
      refund_amount: refundAmount > 0 ? refundAmount : 0,
      requires_refund: refundAmount > 0,
      currency_code: updatedOrder.currency_code,
      message: refundAmount > 0
        ? `Discount applied successfully. Refund of ${refundAmount.toFixed(2)} ${updatedOrder.currency_code?.toUpperCase()} is available.`
        : "Discount applied successfully.",
    })
  } catch (error: any) {
    console.error("Error applying discount:", error.message)
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Failed to apply discount: ${error.message}`
    )
  }
}


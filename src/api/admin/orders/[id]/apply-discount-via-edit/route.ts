import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { MedusaError } from "@medusajs/framework/utils"
import {
  beginOrderEditOrderWorkflow,
  orderEditUpdateItemQuantityWorkflow,
  confirmOrderEditRequestWorkflow,
} from "@medusajs/medusa/core-flows"

type ApplyDiscountRequest = {
  discount_amount?: number
  discount_percentage?: number
  reason?: string
}

export async function POST(
  req: MedusaRequest<ApplyDiscountRequest>,
  res: MedusaResponse
): Promise<void> {
  const { id: orderId } = req.params
  const { discount_amount, discount_percentage, reason } = req.body

  try {
    const orderModuleService = req.scope.resolve("order")

    // Get the current order
    const order = await orderModuleService.retrieveOrder(orderId, {
      relations: ["items"],
      select: ["id", "status", "total", "currency_code"],
    })

    if (!order) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Order with id ${orderId} not found`
      )
    }

    // Calculate discount
    const originalTotal = order.total ? (typeof order.total === 'number' ? order.total : parseFloat(String(order.total))) : 0
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

    console.log("=== Starting Order Edit for Discount ===")
    console.log("Original total:", originalTotal)
    console.log("Discount:", totalDiscount)

    // Check if there's already an active order change
    const query = req.scope.resolve("query")
    const { data: existingChanges } = await query.graph({
      entity: "order_change",
      fields: ["id", "status", "change_type"],
      filters: {
        order_id: orderId,
        status: "pending",
      },
    })

    // Cancel any existing pending order changes
    if (existingChanges && existingChanges.length > 0) {
      console.log("Found existing pending order changes, canceling them...")
      
      for (const change of existingChanges) {
        try {
          // Cancel the order change directly using the order module
          await orderModuleService.cancelOrderChange(change.id)
          console.log("Canceled order change:", change.id)
        } catch (cancelError) {
          console.log("Could not cancel order change:", cancelError)
        }
      }
    }

    // Step 1: Begin Order Edit
    const { result: orderChange } = await beginOrderEditOrderWorkflow(req.scope).run({
      input: {
        order_id: orderId,
        description: reason || "Retroactive discount applied",
        internal_note: `Discount of ${totalDiscount.toFixed(2)} ${order.currency_code}`,
        created_by: (req as any).auth_context?.actor_id || "admin",
      },
    })

    console.log("Order edit created:", orderChange.id)

    // Step 2: Update each item with reduced price using ITEM_UPDATE actions
    const discountPerItem = totalDiscount / (order.items?.length || 1)
    
    const itemsToUpdate = order.items?.map((item) => {
      const originalPrice = item.unit_price || 0
      const newPrice = Math.max(0, originalPrice - discountPerItem)
      
      console.log(`Preparing item update ${item.id}: ${originalPrice} → ${newPrice}`)
      
      return {
        id: item.id,
        quantity: item.quantity,
        unit_price: newPrice,
      }
    }) || []

    // Use the orderEditUpdateItemQuantityWorkflow which creates ITEM_UPDATE actions
    await orderEditUpdateItemQuantityWorkflow(req.scope).run({
      input: {
        order_id: orderId,
        items: itemsToUpdate,
      },
    })

    console.log("All item updates applied to order edit")

    // Step 3: Confirm the order edit - this will update pending_difference
    const { result: orderPreview } = await confirmOrderEditRequestWorkflow(req.scope).run({
      input: {
        order_id: orderId,
        confirmed_by: (req as any).auth_context?.actor_id || "admin",
      },
    })

    console.log("Order edit confirmed!")
    console.log("Order summary:", orderPreview.summary)
    console.log("Pending difference:", orderPreview.summary?.pending_difference)

    // Step 4: Store discount information in metadata for tracking/display
    const discountId = `discount_${Date.now()}`
    const discountCode = `DISCOUNT_${Date.now()}`
    
    const currentMetadata = (orderPreview as any).metadata || {}
    const discountsHistory = Array.isArray(currentMetadata.discounts_history) 
      ? currentMetadata.discounts_history 
      : []

    discountsHistory.push({
      id: discountId,
      code: discountCode,
      amount: totalDiscount,
      type: discount_amount ? 'fixed' : 'percentage',
      percentage: discount_percentage,
      reason: reason || "Retroactive discount applied",
      applied_by: (req as any).auth_context?.actor_id || "admin",
      applied_at: new Date().toISOString(),
      order_change_id: orderChange.id,
    })

    await orderModuleService.updateOrders(orderId, {
      metadata: {
        ...currentMetadata,
        discounts_history: discountsHistory,
      },
    })
    
    console.log("Discount info saved to order metadata")

    res.json({
      success: true,
      order: orderPreview,
      pending_difference: orderPreview.summary?.pending_difference,
      message: "Discount applied successfully via Order Edit. The refund form will now work correctly!",
    })
  } catch (error: any) {
    console.error("Error applying discount via Order Edit:", error)
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Failed to apply discount: ${error.message}`
    )
  }
}


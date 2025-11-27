import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { MedusaError } from "@medusajs/framework/utils"
import {
  beginOrderEditOrderWorkflow,
  orderEditUpdateItemQuantityWorkflow,
  confirmOrderEditRequestWorkflow,
  cancelOrderChangeWorkflow,
} from "@medusajs/medusa/core-flows"

type RemoveDiscountRequest = {
  discount_id: string
}

export async function POST(
  req: MedusaRequest<RemoveDiscountRequest>,
  res: MedusaResponse
): Promise<void> {
  const { id: orderId } = req.params
  const { discount_id } = req.body

  const orderModuleService = req.scope.resolve("order")

  try {
    if (!discount_id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Discount ID is required"
      )
    }

    console.log("=== Removing Discount via Order Edit ===")
    console.log("Order ID:", orderId)
    console.log("Discount ID:", discount_id)

    // Get the order
    const order = await orderModuleService.retrieveOrder(orderId, {
      relations: ["items"],
      select: ["id", "status", "total", "currency_code", "metadata"],
    })

    if (!order) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Order with id ${orderId} not found`
      )
    }

    // Find the discount in metadata
    const currentMetadata = (order as any).metadata || {}
    const discountsHistory = Array.isArray(currentMetadata.discounts_history) 
      ? currentMetadata.discounts_history 
      : []

    const discountIndex = discountsHistory.findIndex((d: any) => d.id === discount_id)
    
    if (discountIndex === -1) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Discount ${discount_id} not found in order metadata`
      )
    }

    const discountToRemove = discountsHistory[discountIndex]
    const discountAmount = discountToRemove.amount
    
    console.log("Discount amount to add back:", discountAmount)

    // Retrieve existing pending order changes separately
    const orderChanges = await orderModuleService.listOrderChanges({
      order_id: orderId,
    })

    // Check for existing pending order changes and cancel them
    const pendingOrderChanges = orderChanges.filter(
      (oc) => oc.status === "pending"
    )

    if (pendingOrderChanges && pendingOrderChanges.length > 0) {
      console.log("Found existing pending order changes, canceling them...")
      for (const change of pendingOrderChanges) {
        try {
          await cancelOrderChangeWorkflow(req.scope).run({
            input: {
              id: change.id,
            },
          })
          console.log(`Canceled order change: ${change.id}`)
        } catch (cancelError: any) {
          console.error("Could not cancel order change:", cancelError)
        }
      }
    }

    // 1. Begin Order Edit
    const { result: orderChange } = await beginOrderEditOrderWorkflow(req.scope).run({
      input: {
        order_id: orderId,
        internal_note: "Discount removed via custom widget",
        created_by: (req as any).auth_context?.actor_id || "admin",
      },
    })

    const orderChangeId = orderChange.id
    console.log("Order edit created:", orderChangeId)

    // 2. Update item prices - add the discount back to increase the price
    const discountPerItem = discountAmount / (order.items?.length || 1)
    
    const itemsToUpdate = order.items?.map((item) => {
      const newUnitPrice = item.unit_price + discountPerItem
      console.log(`Restoring item ${item.id} price: ${item.unit_price} → ${newUnitPrice}`)

      return {
        id: item.id,
        quantity: item.quantity,
        unit_price: newUnitPrice,
      }
    }) || []

    await orderEditUpdateItemQuantityWorkflow(req.scope).run({
      input: {
        order_id: orderId,
        items: itemsToUpdate,
      },
    })

    console.log("Price restoration applied")

    // 3. Remove discount from metadata
    discountsHistory.splice(discountIndex, 1)
    
    await orderModuleService.updateOrders(orderId, {
      metadata: {
        ...currentMetadata,
        discounts_history: discountsHistory,
      },
    })
    
    console.log("Discount removed from metadata")

    // 4. Confirm the Order Edit
    const { result: orderPreview } = await confirmOrderEditRequestWorkflow(req.scope).run({
      input: {
        order_id: orderId,
        confirmed_by: (req as any).auth_context?.actor_id || "admin",
      },
    })

    const newTotal = orderPreview.total ? (typeof orderPreview.total === 'number' ? orderPreview.total : parseFloat(String(orderPreview.total))) : 0

    console.log("Discount removed successfully, new total:", newTotal)

    res.json({
      success: true,
      new_total: newTotal,
      currency_code: order.currency_code,
      message: "Discount removed successfully",
    })
  } catch (error: any) {
    console.error("Error removing discount:", error.message)
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Failed to remove discount: ${error.message}`
    )
  }
}


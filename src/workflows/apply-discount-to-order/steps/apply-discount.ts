import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"

type ApplyDiscountInput = {
  order_id: string
  discount_amount?: number
  discount_percentage?: number
  promotion_codes?: string[]
  reason?: string
  created_by?: string
}

export const applyDiscountToOrderStep = createStep(
  "apply-discount-to-order-step",
  async (input: ApplyDiscountInput, { container }) => {
    const orderModuleService = container.resolve("order")

    const {
      order_id,
      discount_amount,
      promotion_codes,
      reason,
    } = input

    // Get the current order
    const order = await orderModuleService.retrieveOrder(order_id, {
      relations: ["items", "items.adjustments"],
    })

    if (!order) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Order with id ${order_id} not found`
      )
    }

    // Check if order can be edited
    if (order.status === "canceled") {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Cannot apply discount to a canceled order"
      )
    }

    const originalTotal = parseFloat(String(order.total))

    // Calculate discount per item
    if (!discount_amount || discount_amount <= 0) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Discount amount must be greater than 0"
      )
    }

    const itemsCount = order.items?.length || 0
    const discountPerItem = discount_amount / itemsCount

    // Prepare adjustment actions
    // Note: Adjustment amounts should be positive - Medusa will subtract them from the total
    const adjustmentActions = order.items.map((item) => ({
      item_id: item.id,
      amount: Math.abs(discountPerItem),
    }))

    // Apply adjustments to order line items
    await orderModuleService.setOrderLineItemAdjustments(
      order_id,
      adjustmentActions
    )

    return new StepResponse(
      {
        id: order_id,
        order_id: order_id,
        original_total: originalTotal,
        discount_amount: discount_amount,
      },
      {
        order_id: order_id,
        previous_adjustments: order.items.map((item) => ({
          item_id: item.id,
          adjustments: item.adjustments || [],
        })),
      }
    )
  },
  async (data, { container }) => {
    if (!data?.order_id || !data?.previous_adjustments) {
      return
    }

    const orderModuleService = container.resolve("order")

    try {
      // Restore previous adjustments
      const restoreActions = data.previous_adjustments.flatMap((item: any) =>
        item.adjustments.map((adj: any) => ({
          item_id: item.item_id,
          amount: adj.amount,
        }))
      )

      if (restoreActions.length > 0) {
        await orderModuleService.setOrderLineItemAdjustments(
          data.order_id,
          restoreActions
        )
      }
    } catch (error) {
      console.error("Failed to compensate order adjustments:", error)
    }
  }
)


import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"

type CalculateRefundInput = {
  order_id: string
}

export const calculateRefundStep = createStep(
  "calculate-refund-step",
  async (input: CalculateRefundInput, { container }) => {
    const orderModuleService = container.resolve("order")

    const { order_id } = input

    // Get the updated order to calculate refund amount
    const order: any = await orderModuleService.retrieveOrder(order_id, {
      relations: ["items", "payment_collection", "payment_collection.payments"],
    })

    if (!order) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Order with id ${order_id} not found`
      )
    }

    const newTotal = parseFloat(String(order.total))
    const paidAmount =
      order.payment_collection?.payments?.reduce(
        (sum: number, payment: any) => sum + parseFloat(String(payment.amount)),
        0
      ) || 0

    const refundAmount = paidAmount - newTotal

    return new StepResponse({
      order_id: order_id,
      new_total: newTotal,
      paid_amount: paidAmount,
      refund_amount: refundAmount > 0 ? refundAmount : 0,
      requires_refund: refundAmount > 0,
      currency_code: order.currency_code,
    })
  }
)


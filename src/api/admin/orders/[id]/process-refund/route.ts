import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { MedusaError } from "@medusajs/framework/utils"
import { refundPaymentsWorkflow } from "@medusajs/medusa/core-flows"

type ProcessRefundRequest = {
  amount: number
  reason?: string
  note?: string
}

export async function POST(
  req: MedusaRequest<ProcessRefundRequest>,
  res: MedusaResponse
): Promise<void> {
  const { id: orderId } = req.params
  const { amount, reason, note } = req.body

  const orderModuleService = req.scope.resolve("order")

  try {
    // Get the order with payment information
    const order: any = await orderModuleService.retrieveOrder(orderId, {
      relations: ["payment_collection", "payment_collection.payments"],
    })

    if (!order) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Order with id ${orderId} not found`
      )
    }

    // Check if order has payments
    if (!order.payment_collection?.payments || order.payment_collection.payments.length === 0) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Order has no payments to refund"
      )
    }

    // Calculate total paid amount
    const paidAmount = order.payment_collection.payments.reduce(
      (sum: number, payment: any) => sum + parseFloat(String(payment.amount)),
      0
    )

    // Validate refund amount
    if (amount > paidAmount) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Refund amount ${amount} exceeds paid amount ${paidAmount}`
      )
    }

    if (amount <= 0) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Refund amount must be greater than 0"
      )
    }

    // Get the first payment (in most cases there's only one)
    const payment = order.payment_collection.payments[0]

    // Create a refund using the workflow
    const { result } = await refundPaymentsWorkflow(req.scope).run({
      input: [{
        payment_id: payment.id,
        amount: amount,
        created_by: (req as any).auth_context?.actor_id,
        note: note || reason || "Retroactive discount refund",
      }],
    })

    // Optionally update order metadata with refund info
    await orderModuleService.updateOrders(orderId, {
      metadata: {
        ...order.metadata,
        refunds: [
          ...(Array.isArray(order.metadata?.refunds) ? order.metadata.refunds : []),
          {
            amount: amount,
            reason: reason || "Retroactive discount",
            note: note,
            created_at: new Date().toISOString(),
            created_by: (req as any).auth_context?.actor_id,
          },
        ],
      },
    })

    res.json({
      refund: result[0],
      message: `Refund of ${amount.toFixed(2)} ${order.currency_code?.toUpperCase()} processed successfully`,
    })
  } catch (error: any) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Failed to process refund: ${error.message}`
    )
  }
}


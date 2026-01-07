import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { Modules } from '@medusajs/framework/utils'
import { sendDashboardWebhook } from '../utils/webhook-signature'

export default async function refundCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<any>) {
  console.log('🔵 Payment refunded event received:', JSON.stringify(data, null, 2))

  try {
    const paymentModule = container.resolve(Modules.PAYMENT)
    const orderModule = container.resolve(Modules.ORDER)
    
    // Get payment ID from event data
    const paymentId = data.id || data.payment_id
    const refundAmount = data.amount
    
    if (!paymentId) {
      console.error('❌ No payment ID in refund event data')
      return
    }

    // Get the payment to find the order
    const payment = await paymentModule.retrievePayment(paymentId, {
      relations: ['payment_collection', 'refunds']
    }) as any
    
    if (!payment?.payment_collection_id) {
      console.error('❌ Payment has no payment_collection_id')
      return
    }

    // Get payment collection to find the order
    const paymentCollection = await paymentModule.retrievePaymentCollection(
      payment.payment_collection_id
    ) as any

    // Try to find order ID from payment collection context
    const orderId = paymentCollection?.context?.order_id
    
    if (!orderId) {
      console.error('❌ Could not find order ID from payment collection')
      return
    }

    // Get order details
    const order = await orderModule.retrieveOrder(orderId, {
      relations: ['billing_address', 'shipping_address', 'customer']
    })

    // Get the latest refund
    const refunds = payment.refunds || []
    const latestRefund = refunds[refunds.length - 1]

    console.log('📤 Sending refund to Dashboard for credit note generation')

    // Send to Dashboard for credit note generation
    const result = await sendDashboardWebhook({
      endpoint: '/webhooks/medusa/refunds',
      data: {
        order_id: orderId,
        order: {
          id: order.id,
          display_id: order.display_id,
          created_at: order.created_at,
          email: order.email,
          currency_code: order.currency_code,
          billing_address: order.billing_address,
          shipping_address: order.shipping_address,
          customer: (order as any).customer,
        },
        refund: {
          id: latestRefund?.id || paymentId,
          amount: refundAmount,
          reason: latestRefund?.note || data.note,
          created_at: latestRefund?.created_at || new Date().toISOString(),
        }
      },
      eventName: 'payment.refunded'
    })

    if (result.success) {
      console.log('✅ Refund sent to Dashboard for credit note generation')
    } else {
      console.error('❌ Error sending refund to Dashboard:', result.error)
    }
  } catch (error) {
    console.error('❌ Error sending refund to Dashboard:', error)
  }
}

export const config: SubscriberConfig = {
  event: 'payment.refunded',
}


import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { Modules } from '@medusajs/framework/utils'
import axios from 'axios'

/**
 * Send order data to Laravel Dashboard for invoice generation
 */
export async function orderPlacedWebhookHandler({
  event: { data },
  container,
}: SubscriberArgs<any>) {
  const orderModule = container.resolve(Modules.ORDER)
  
  try {
    // Get full order details
    const order = await orderModule.retrieveOrder(data.id, {
      relations: [
        'items',
        'items.variant',
        'items.variant.product',
        'billing_address',
        'shipping_address',
        'shipping_methods',
        'customer',
      ]
    })

    console.log('📤 Sending order to Dashboard for invoice generation:', order.id)

    // Send to Laravel Dashboard webhook
    await axios.post(
      `${process.env.DASHBOARD_URL}/api/webhooks/medusa/order-placed`,
      {
        event: 'order.placed',
        order_id: order.id,
        order: {
          id: order.id,
          display_id: order.display_id,
          created_at: order.created_at,
          email: order.email,
          currency_code: order.currency_code,
          total: order.total,
          subtotal: order.subtotal,
          tax_total: order.tax_total,
          discount_total: order.discount_total,
          shipping_total: (order as any).shipping_methods?.reduce(
            (sum: number, method: any) => sum + Number(method.amount), 
            0
          ) || 0,
          items: (order as any).items?.map((item: any) => ({
            id: item.id,
            title: item.title,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.total,
            variant_id: item.variant_id,
            product_title: item.variant?.product?.title,
          })),
          billing_address: order.billing_address,
          shipping_address: order.shipping_address,
          customer: (order as any).customer ? {
            id: (order as any).customer.id,
            email: (order as any).customer.email,
            first_name: (order as any).customer.first_name,
            last_name: (order as any).customer.last_name,
          } : null,
          metadata: order.metadata,
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Medusa-Signature': process.env.WEBHOOK_SECRET || '',
        }
      }
    )

    console.log('✅ Order sent to Dashboard successfully')
  } catch (error) {
    console.error('❌ Error sending order to Dashboard:', error)
  }
}

/**
 * Send refund data to Laravel Dashboard for credit note generation
 */
async function refundCreatedWebhookHandler({
  event: { data },
  container,
}: SubscriberArgs<any>) {
  const paymentModule = container.resolve(Modules.PAYMENT)
  const orderModule = container.resolve(Modules.ORDER)
  
  try {
    // Get payment details
    const payment = await paymentModule.retrievePayment(data.id, {
      relations: ['payment_collection', 'refunds']
    }) as any

    const paymentCollection = await paymentModule.retrievePaymentCollection(
      payment.payment_collection_id
    ) as any

    const orderId = paymentCollection?.context?.order_id
    
    if (!orderId) {
      console.warn('⚠️  No order_id found for refund')
      return
    }

    // Get order details
    const order = await orderModule.retrieveOrder(orderId, {
      relations: [
        'items',
        'billing_address',
        'shipping_address',
        'customer',
      ]
    })

    // Get the latest refund
    const refunds = payment.refunds || []
    const latestRefund = refunds[refunds.length - 1]

    if (!latestRefund) {
      console.warn('⚠️  No refund found')
      return
    }

    console.log('📤 Sending refund to Dashboard for credit note generation:', latestRefund.id)

    // Send to Laravel Dashboard webhook
    await axios.post(
      `${process.env.DASHBOARD_URL}/api/webhooks/medusa/refund-created`,
      {
        event: 'payment.refunded',
        order_id: order.id,
        refund: {
          id: latestRefund.id,
          amount: latestRefund.amount,
          reason: latestRefund.note,
          created_at: latestRefund.created_at,
        },
        order: {
          id: order.id,
          display_id: order.display_id,
          email: order.email,
          currency_code: order.currency_code,
          billing_address: order.billing_address,
          shipping_address: order.shipping_address,
          customer: (order as any).customer ? {
            id: (order as any).customer.id,
            email: (order as any).customer.email,
            first_name: (order as any).customer.first_name,
            last_name: (order as any).customer.last_name,
          } : null,
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Medusa-Signature': process.env.WEBHOOK_SECRET || '',
        }
      }
    )

    console.log('✅ Refund sent to Dashboard successfully')
  } catch (error) {
    console.error('❌ Error sending refund to Dashboard:', error)
  }
}

export const orderPlacedConfig: SubscriberConfig = {
  event: 'order.placed'
}

export const refundCreatedConfig: SubscriberConfig = {
  event: 'payment.refunded'
}

export default orderPlacedWebhookHandler
export { refundCreatedWebhookHandler }



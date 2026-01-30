import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'
import { IPaymentModuleService } from '@medusajs/framework/types'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { sendDashboardWebhook } from '../utils/webhook-signature'

/**
 * Subscriber to handle payment.captured event
 * Sends webhook to Dashboard to start the order workflow
 */
export default async function paymentCapturedHandler({
  event: { data },
  container,
}: SubscriberArgs<any>) {
  const logger = container.resolve('logger')
  
  try {
    logger.info(`💳 Payment captured event received: ${JSON.stringify(data)}`)
    
    const paymentModule: IPaymentModuleService = container.resolve(Modules.PAYMENT)
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    
    // Get payment details
    const paymentId = data.id
    if (!paymentId) {
      logger.warn('Payment captured event missing payment ID')
      return
    }
    
    // Retrieve the payment with related data
    const payment = await paymentModule.retrievePayment(paymentId, {
      relations: ['payment_collection']
    })
    
    if (!payment) {
      logger.warn(`Payment not found: ${paymentId}`)
      return
    }
    
    logger.info(`💳 Payment details: ${payment.id}, amount: ${payment.amount}, provider: ${payment.provider_id}`)
    
    // Find the order associated with this payment collection using Query API
    // This traverses the remote link between order and payment_collection
    let order = null
    
    if (payment.payment_collection_id) {
      const { data: orders } = await query.graph({
        entity: 'order',
        fields: [
          'id',
          'display_id',
          'email',
          'currency_code',
          'total',
          'subtotal',
          'tax_total',
          'shipping_total',
          'customer_id',
          'metadata',
          'payment_collections.id',
        ],
        filters: {
          payment_collections: {
            id: payment.payment_collection_id
          }
        }
      })
      
      if (orders && orders.length > 0) {
        order = orders[0]
      }
    }
    
    if (!order) {
      logger.warn(`No order found for payment ${payment.id}, collection: ${payment.payment_collection_id}`)
      return
    }
    
    logger.info(`📦 Found order ${order.id} (${order.display_id}) for payment ${payment.id}`)
    
    // Send webhook to Dashboard
    const result = await sendDashboardWebhook({
      endpoint: '/webhooks/medusa/payments',
      data: {
        order_id: order.id,
        order_display_id: order.display_id,
        payment: {
          id: payment.id,
          amount: payment.amount,
          currency_code: payment.currency_code,
          provider_id: payment.provider_id,
          captured_at: payment.captured_at,
          payment_collection_id: payment.payment_collection_id,
        },
        order: {
          id: order.id,
          display_id: order.display_id,
          email: order.email,
          currency_code: order.currency_code,
          total: order.total,
          subtotal: order.subtotal,
          tax_total: order.tax_total,
          shipping_total: order.shipping_total,
          customer_id: order.customer_id,
          metadata: order.metadata,
        }
      },
      eventName: 'payment.captured'
    })
    
    if (result.success) {
      logger.info(`✅ Payment captured webhook sent to Dashboard for order ${order.id}`)
    } else {
      logger.error(`❌ Failed to send payment captured webhook for order ${order.id}: ${result.error}`)
    }
    
  } catch (error) {
    logger.error(`Error in payment-captured subscriber: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export const config: SubscriberConfig = {
  event: 'payment.captured'
}

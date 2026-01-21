import { Modules } from '@medusajs/framework/utils'
import { IOrderModuleService, IPaymentModuleService } from '@medusajs/framework/types'
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
    logger.info('💳 Payment captured event received', { data })
    
    const paymentModule: IPaymentModuleService = container.resolve(Modules.PAYMENT)
    const orderModule: IOrderModuleService = container.resolve(Modules.ORDER)
    
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
      logger.warn('Payment not found', { paymentId })
      return
    }
    
    logger.info('💳 Payment details', {
      paymentId: payment.id,
      amount: payment.amount,
      currencyCode: payment.currency_code,
      providerId: payment.provider_id,
      capturedAt: payment.captured_at,
      paymentCollectionId: payment.payment_collection_id,
    })
    
    // Find the order associated with this payment
    // We need to query for orders that have this payment_collection_id
    let order = null
    
    if (payment.payment_collection_id) {
      const orders = await orderModule.listOrders({
        // @ts-ignore - payment_collection_id is a valid filter
        payment_collection_id: payment.payment_collection_id
      }, {
        relations: ['items', 'shipping_address', 'billing_address', 'customer']
      })
      
      if (orders && orders.length > 0) {
        order = orders[0]
      }
    }
    
    if (!order) {
      logger.warn('No order found for payment', { 
        paymentId: payment.id,
        paymentCollectionId: payment.payment_collection_id 
      })
      return
    }
    
    logger.info('📦 Found order for payment', {
      orderId: order.id,
      displayId: order.display_id,
      paymentId: payment.id,
    })
    
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
      logger.info('✅ Payment captured webhook sent to Dashboard', {
        orderId: order.id,
        paymentId: payment.id,
      })
    } else {
      logger.error('❌ Failed to send payment captured webhook', {
        orderId: order.id,
        paymentId: payment.id,
        error: result.error,
      })
    }
    
  } catch (error) {
    logger.error('Error in payment-captured subscriber', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
  }
}

export const config: SubscriberConfig = {
  event: 'payment.captured'
}

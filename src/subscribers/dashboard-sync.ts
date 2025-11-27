import { Modules } from '@medusajs/framework/utils'
import { 
  IOrderModuleService, 
  ICustomerModuleService, 
  IProductModuleService 
} from '@medusajs/framework/types'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { DASHBOARD_API_URL, DASHBOARD_WEBHOOK_SECRET } from '../lib/constants'

export default async function dashboardSync({
  event: { name, data },
  container,
}: SubscriberArgs<any>) {
  const logger = container.resolve('logger')

  if (!DASHBOARD_API_URL) {
    logger.debug('DASHBOARD_API_URL is not set, skipping dashboard sync')
    return
  }

  // Check if dashboard URL is reachable (basic validation)
  if (!DASHBOARD_API_URL.startsWith('http://') && !DASHBOARD_API_URL.startsWith('https://')) {
    logger.warn(`Invalid DASHBOARD_API_URL format: ${DASHBOARD_API_URL}`)
    return
  }

  try {
    let payload: any = null
    let endpoint = ''

    switch (name) {
      case 'order.placed':
      case 'order.updated':
        const orderModuleService: IOrderModuleService = container.resolve(Modules.ORDER)
        const customerModuleServiceForOrder: ICustomerModuleService = container.resolve(Modules.CUSTOMER)
        
        // Retrieve full order with relations
        const order = await orderModuleService.retrieveOrder(data.id, { 
          relations: ['items', 'shipping_address', 'billing_address'] 
        })

        // Fetch and attach customer if present
        if (order.customer_id) {
            try {
                const customer = await customerModuleServiceForOrder.retrieveCustomer(order.customer_id)
                Object.assign(order, { customer })
            } catch (e) {
                logger.warn(`Could not retrieve customer ${order.customer_id} for order ${order.id}`)
            }
        }

        payload = order
        endpoint = '/webhooks/medusa/orders'
        break

      case 'customer.created':
      case 'customer.updated':
        const customerModuleService: ICustomerModuleService = container.resolve(Modules.CUSTOMER)
        payload = await customerModuleService.retrieveCustomer(data.id, {
            relations: ['addresses']
        })
        endpoint = '/webhooks/medusa/customers'
        break

      case 'product.created':
      case 'product.updated':
        const productModuleService: IProductModuleService = container.resolve(Modules.PRODUCT)
        payload = await productModuleService.retrieveProduct(data.id, {
            relations: ['variants', 'options', 'tags', 'type', 'collection', 'images']
        })
        endpoint = '/webhooks/medusa/products'
        break

      default:
        return
    }

    if (payload && endpoint) {
      await sendToDashboard(endpoint, payload, name, logger)
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error(`Failed to sync ${name} to dashboard: ${errorMessage}`)
    logger.debug(`Sync error details - event: ${name}, dataId: ${data?.id}, dashboardUrl: ${DASHBOARD_API_URL}, error: ${errorMessage}`)
  }
}

async function sendToDashboard(endpoint: string, data: any, eventName: string, logger: any) {
    const url = `${DASHBOARD_API_URL}${endpoint}`
    
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-medusa-event': eventName,
    }

    if (DASHBOARD_WEBHOOK_SECRET) {
        // TODO: Sign the payload if needed, for now just passing the secret if that's what's expected
        // But usually signature is HMAC. Dashboard controller checks for 'x-medusa-signature'
        // For now, we assume the dashboard might verify signature later. 
        // If we want to be secure, we should implement HMAC-SHA256 signature.
        // But simple secret checking isn't implemented in the dashboard yet ("TODO: Implement signature verification").
        // So we skip complex signature for now.
    }

    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 10000) // 10 second timeout

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(data),
            signal: controller.signal,
        })

        clearTimeout(timeout)

        if (!response.ok) {
            const text = await response.text()
            throw new Error(`Dashboard responded with ${response.status}: ${text}`)
        }

        const result = await response.json()
        logger.info(`✓ Synced ${eventName} to dashboard`, {
            event: eventName,
            orderId: data?.id,
            displayId: data?.display_id,
        })
    } catch (e) {
        const errorMsg = e.name === 'AbortError' ? 'Request timeout after 10s' : e.message
        logger.error(`✗ Error sending webhook to ${url}: ${errorMsg}`, {
            event: eventName,
            url,
            error: errorMsg,
            cause: e.cause?.code || 'unknown',
        })
        
        // Don't throw - we don't want to fail the order placement if dashboard sync fails
        // The order can be manually synced later using the sync API
    }
}

export const config: SubscriberConfig = {
  event: [
    'order.placed',
    'order.updated',
    'customer.created',
    'customer.updated',
    'product.created',
    'product.updated'
  ]
}


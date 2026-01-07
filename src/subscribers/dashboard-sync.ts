import { Modules } from '@medusajs/framework/utils'
import { 
  IOrderModuleService, 
  ICustomerModuleService, 
  IProductModuleService 
} from '@medusajs/framework/types'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { DASHBOARD_API_URL } from '../lib/constants'
import { COMPANY_MODULE } from '../modules/company'
import type CompanyModuleService from '../modules/company/service'
import { sendDashboardWebhook } from '../utils/webhook-signature'

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
          relations: ['items', 'shipping_address', 'billing_address', 'summary'] 
        })

        // Loop prevention: Check if this was recently synced from dashboard
        if (shouldSkipSync(order.metadata, 'order', logger)) {
          logger.info(`Skipping order sync to prevent loop - orderId: ${order.id}`)
          return
        }

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
        const customer = await customerModuleService.retrieveCustomer(data.id, {
            relations: ['addresses']
        })

        // Loop prevention: Check if this was recently synced from dashboard
        if (shouldSkipSync(customer.metadata, 'customer', logger)) {
          logger.info(`Skipping customer sync to prevent loop - customerId: ${customer.id}`)
          return
        }

        payload = customer
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

      case 'company.created':
      case 'company.updated':
        const companyModuleService: CompanyModuleService = container.resolve(COMPANY_MODULE)
        const company = await companyModuleService.retrieveCompany(data.id)

        // Loop prevention: Check if this was recently synced from dashboard
        if (shouldSkipSync(company.metadata, 'company', logger)) {
          logger.info(`Skipping company sync to prevent loop - companyId: ${company.id}`)
          return
        }

        payload = company
        endpoint = '/webhooks/medusa/companies'
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

/**
 * Check if sync should be skipped to prevent endless loops
 * Returns true if this entity was recently synced FROM the dashboard
 */
function shouldSkipSync(metadata: any, entityType: string, logger: any): boolean {
  if (!metadata) return false

  const lastSyncedFrom = metadata._last_synced_from
  const lastSyncedAt = metadata._last_synced_at

  // If this was synced from dashboard, check if it's recent (within 30 seconds)
  if (lastSyncedFrom === 'dashboard' && lastSyncedAt) {
    try {
      const syncedAt = new Date(lastSyncedAt)
      const now = new Date()
      const diffInSeconds = (now.getTime() - syncedAt.getTime()) / 1000

      if (diffInSeconds < 30) {
        logger.debug(`${entityType} was synced from dashboard ${diffInSeconds}s ago, skipping to prevent loop`)
        return true
      }
    } catch (e) {
      logger.warn(`Failed to parse _last_synced_at date: ${lastSyncedAt}`)
    }
  }

  return false
}

async function sendToDashboard(endpoint: string, data: any, eventName: string, logger: any) {
    const result = await sendDashboardWebhook({
        endpoint,
        data,
        eventName,
    })

    if (result.success) {
        logger.info(`✓ Synced ${eventName} to dashboard`, {
            event: eventName,
            orderId: data?.id,
            displayId: data?.display_id,
        })
    } else {
        logger.error(`✗ Error sending webhook: ${result.error}`, {
            event: eventName,
            endpoint,
            error: result.error,
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
    'company.created',
    'company.updated',
    'product.created',
    'product.updated'
  ]
}


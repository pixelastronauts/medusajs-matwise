import { Modules } from '@medusajs/framework/utils'
import { IProductModuleService } from '@medusajs/framework/types'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { DASHBOARD_API_URL } from '../lib/constants'
import { sendDashboardWebhook } from '../utils/webhook-signature'

/**
 * Subscriber to sync product variants to the dashboard
 * Handles product-variant.created and product-variant.updated events
 */
export default async function variantSync({
  event: { name, data },
  container,
}: SubscriberArgs<any>) {
  const logger = container.resolve('logger')

  if (!DASHBOARD_API_URL) {
    logger.debug('DASHBOARD_API_URL is not set, skipping variant sync')
    return
  }

  // Check if dashboard URL is reachable (basic validation)
  if (!DASHBOARD_API_URL.startsWith('http://') && !DASHBOARD_API_URL.startsWith('https://')) {
    logger.warn(`Invalid DASHBOARD_API_URL format: ${DASHBOARD_API_URL}`)
    return
  }

  try {
    const productModuleService: IProductModuleService = container.resolve(Modules.PRODUCT)
    
    // Retrieve the full variant with all relations
    const variants = await productModuleService.listProductVariants(
      { id: data.id },
      {
        relations: ['options', 'options.option', 'product'],
        select: ['id', 'title', 'sku', 'barcode', 'ean', 'upc', 'allow_backorder', 
                'manage_inventory', 'inventory_quantity', 'weight', 'length', 'height', 
                'width', 'hs_code', 'origin_country', 'mid_code', 'material', 'metadata', 
                'product_id', 'created_at', 'updated_at']
      }
    )

    if (!variants || variants.length === 0) {
      logger.warn(`Variant ${data.id} not found`)
      return
    }

    const variant = variants[0]

    // Loop prevention: Check if this was recently synced from dashboard
    if (shouldSkipSync(variant.metadata, logger)) {
      logger.info(`Skipping variant sync to prevent loop - variantId: ${variant.id}`)
      return
    }

    logger.info(`📤 Syncing variant to dashboard - event: ${name}, variant_id: ${variant.id}, sku: ${variant.sku}, is_custom: ${variant.metadata?.is_custom_order || variant.metadata?.is_custom || false}`)

    // Send webhook to dashboard
    const endpoint = '/webhooks/medusa/variants'
    const result = await sendDashboardWebhook({
      endpoint,
      data: variant,
      eventName: name,
    })

    if (result.success) {
      logger.info(`✓ Synced variant to dashboard - event: ${name}, variant_id: ${variant.id}, sku: ${variant.sku}`)
    } else {
      logger.error(`✗ Error syncing variant to dashboard: ${result.error} - event: ${name}, variant_id: ${variant.id}, endpoint: ${endpoint}`)
      // Don't throw - we don't want to fail the operation if dashboard sync fails
      // The variant can be manually synced later
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error(`Failed to sync ${name} to dashboard: ${errorMessage} - event: ${name}, variant_id: ${data?.id}`)
  }
}

/**
 * Check if sync should be skipped to prevent endless loops
 * Returns true if this variant was recently synced FROM the dashboard
 */
function shouldSkipSync(metadata: any, logger: any): boolean {
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
        logger.debug(`Variant was synced from dashboard ${diffInSeconds}s ago, skipping to prevent loop`)
        return true
      }
    } catch (e) {
      logger.warn(`Failed to parse _last_synced_at date: ${lastSyncedAt}`)
    }
  }

  return false
}

export const config: SubscriberConfig = {
  event: [
    'product-variant.created',
    'product-variant.updated',
  ]
}

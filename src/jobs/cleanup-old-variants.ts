import { 
  Modules,
} from "@medusajs/framework/utils"
import type { 
  IProductModuleService,
  IOrderModuleService,
  MedusaContainer,
} from "@medusajs/framework/types"

/**
 * Scheduled job to clean up old custom variants that are not in any orders
 * 
 * This job runs daily at 3 AM and:
 * 1. Finds custom variants older than 7 days
 * 2. Checks if they're not in any orders
 * 3. Deletes them to keep the database clean
 */
export default async function cleanupOldVariantsHandler(
  container: MedusaContainer
) {
  const logger = container.resolve('logger')
  const productModuleService: IProductModuleService = container.resolve(Modules.PRODUCT)
  const orderModuleService: IOrderModuleService = container.resolve(Modules.ORDER)

  logger.info('🧹 Starting cleanup of old unused custom variants...')

  try {
    // Calculate the date 7 days ago
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    // Get all variants (we'll filter in code since metadata queries might be limited)
    const allVariants = await productModuleService.listProductVariants(
      {},
      {
        select: ['id', 'created_at', 'metadata'],
        take: 10000, // Adjust if you have more variants
      }
    )

    logger.info(`Found ${allVariants.length} total variants to check`)

    // Filter for custom variants older than 7 days
    const oldCustomVariants = allVariants.filter((variant) => {
      const isCustom = variant.metadata?.is_custom_order === true
      const isOld = new Date(variant.created_at) < sevenDaysAgo
      return isCustom && isOld
    })

    logger.info(`Found ${oldCustomVariants.length} old custom variants to check`)

    if (oldCustomVariants.length === 0) {
      logger.info('✅ No old custom variants to clean up')
      return
    }

    // Get all orders to check which variants are in use
    const orders = await orderModuleService.listOrders(
      {},
      {
        relations: ['items'],
        take: 10000, // Adjust if you have more orders
      }
    )

    // Create a Set of variant IDs that are in orders
    const variantIdsInOrders = new Set<string>()
    orders.forEach((order) => {
      order.items?.forEach((item) => {
        if (item.variant_id) {
          variantIdsInOrders.add(item.variant_id)
        }
      })
    })

    logger.info(`Found ${variantIdsInOrders.size} unique variants in orders`)

    // Filter out variants that are in orders
    const variantsToDelete = oldCustomVariants.filter(
      (variant) => !variantIdsInOrders.has(variant.id)
    )

    logger.info(`Deleting ${variantsToDelete.length} unused old custom variants`)

    // Delete the variants
    let deletedCount = 0
    for (const variant of variantsToDelete) {
      try {
        await productModuleService.deleteProductVariants([variant.id])
        deletedCount++
        
        if (deletedCount % 10 === 0) {
          logger.info(`Deleted ${deletedCount}/${variantsToDelete.length} variants...`)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error(`Failed to delete variant ${variant.id}: ${errorMessage}`)
      }
    }

    logger.info(`✅ Cleanup complete: Deleted ${deletedCount} old unused custom variants`)
    
    // Log statistics
    logger.info(`📊 Cleanup statistics - total_variants_checked: ${allVariants.length}, old_custom_variants: ${oldCustomVariants.length}, variants_in_orders: ${variantIdsInOrders.size}, variants_deleted: ${deletedCount}`)

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const stackTrace = error instanceof Error ? error.stack : 'No stack trace available'
    logger.error(`❌ Error during variant cleanup: ${errorMessage} - stack: ${stackTrace}`)
  }
}

export const config = {
  name: "cleanup-old-custom-variants",
  // Run daily at 3 AM
  schedule: "0 3 * * *",
}


import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Cleanup duplicate tax providers and reassign regions to the correct provider
 * 
 * Run with: medusa exec ./src/scripts/cleanup-tax-providers.ts
 */
export default async function cleanupTaxProviders({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const taxModuleService = container.resolve(Modules.TAX)

  try {
    logger.info("🧹 Cleaning up tax providers...")

    // Get all tax providers
    const taxProviders = await taxModuleService.listTaxProviders({})
    
    logger.info(`Found ${taxProviders.length} tax provider(s):`)
    taxProviders.forEach(provider => {
      logger.info(`  - ${provider.id} ${provider.is_enabled ? '✓' : '✗ (disabled)'}`)
    })

    // Find the correct VAT tax provider
    const vatTaxProvider = taxProviders.find(p => p.id === 'tp_vat_tax_provider_vat_tax_provider')
    
    if (!vatTaxProvider) {
      logger.error("❌ Could not find tp_vat_tax_provider_vat_tax_provider!")
      logger.info("Please restart the Medusa server to register the provider correctly.")
      return
    }

    logger.info(`\n✓ Using VAT tax provider: ${vatTaxProvider.id}`)

    // Get all tax regions
    const taxRegions = await taxModuleService.listTaxRegions({})
    logger.info(`\nFound ${taxRegions.length} tax region(s)`)

    // Update all tax regions to use the correct provider
    let updated = 0
    let errors = 0
    
    for (const taxRegion of taxRegions) {
      try {
        if (taxRegion.provider_id !== vatTaxProvider.id) {
          await taxModuleService.updateTaxRegions(taxRegion.id, {
            provider_id: vatTaxProvider.id,
          })
          logger.info(`  ✓ Updated ${taxRegion.country_code?.toUpperCase()} to use ${vatTaxProvider.id}`)
          updated++
        } else {
          logger.info(`  - ${taxRegion.country_code?.toUpperCase()} already using correct provider`)
        }
      } catch (error) {
        logger.error(`  ✗ Failed to update ${taxRegion.country_code?.toUpperCase()}: ${error.message}`)
        errors++
      }
    }

    logger.info(`\n✅ Cleanup complete!`)
    logger.info(`  - Updated: ${updated} regions`)
    logger.info(`  - Already correct: ${taxRegions.length - updated - errors} regions`)
    if (errors > 0) {
      logger.info(`  - Errors: ${errors} regions`)
    }
    
    logger.info(`\n💡 Next steps:`)
    logger.info(`  1. Restart the Medusa server to clear any cached providers`)
    logger.info(`  2. Test checkout in different countries`)
    logger.info(`  3. Check tax calculations in the storefront\n`)

  } catch (error) {
    logger.error("❌ Error during cleanup:", error)
    throw error
  }
}



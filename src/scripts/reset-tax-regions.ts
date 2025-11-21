import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createTaxRegionsWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Reset all tax regions - delete corrupted ones and recreate fresh
 * 
 * Run with: medusa exec ./src/scripts/reset-tax-regions.ts
 */
export default async function resetTaxRegions({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const taxModuleService = container.resolve(Modules.TAX)

  try {
    logger.info("🔄 Resetting all tax regions...")

    // Get VAT tax provider
    const taxProviders = await taxModuleService.listTaxProviders({})
    const vatTaxProvider = taxProviders.find(p => p.id === 'tp_vat_tax_provider_vat_tax_provider')
    
    if (!vatTaxProvider) {
      logger.error("❌ VAT tax provider not found!")
      return
    }

    logger.info(`✓ Found VAT tax provider: ${vatTaxProvider.id}`)

    // Get all tax regions
    const allTaxRegions = await taxModuleService.listTaxRegions({})
    logger.info(`Found ${allTaxRegions.length} existing tax region(s)`)

    // Delete all tax regions (including corrupted ones)
    let deleted = 0
    for (const region of allTaxRegions) {
      try {
        if (region.id && region.id !== '') {
          await taxModuleService.deleteTaxRegions(region.id)
          logger.info(`  ✓ Deleted ${region.country_code?.toUpperCase()} (${region.id})`)
          deleted++
        } else {
          logger.warn(`  ⚠ Skipped corrupted region ${region.country_code?.toUpperCase()} (empty ID)`)
        }
      } catch (error) {
        logger.warn(`  ⚠ Could not delete ${region.country_code?.toUpperCase()}: ${error.message}`)
      }
    }

    logger.info(`\n✓ Deleted ${deleted} tax regions`)

    // EU countries list
    const euCountries = [
      'nl', 'be', 'de', 'fr', 'es', 'it', 'at', 'pt', 'ie', 'dk', 'se', 'fi',
      'pl', 'cz', 'ro', 'hu', 'gr', 'bg', 'hr', 'sk', 'si', 'lt', 'lv', 'ee',
      'cy', 'lu', 'mt'
    ]

    logger.info(`\nCreating ${euCountries.length} fresh tax regions...`)

    // Create all tax regions fresh
    const regionsToCreate = euCountries.map(countryCode => ({
      country_code: countryCode,
      provider_id: vatTaxProvider.id,
      metadata: {
        is_eu: true,
        is_home_country: countryCode.toLowerCase() === 'nl',
      },
    }))

    await createTaxRegionsWorkflow(container).run({
      input: regionsToCreate,
    })

    logger.info(`✓ Created ${euCountries.length} tax regions`)

    // Verify
    const newRegions = await taxModuleService.listTaxRegions({})
    logger.info(`\n✅ Reset complete!`)
    logger.info(`  - Total regions: ${newRegions.length}`)
    logger.info(`  - All using provider: ${vatTaxProvider.id}\n`)

  } catch (error) {
    logger.error("❌ Error resetting tax regions:", error)
    throw error
  }
}


import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Script to verify the VAT tax setup is correct
 * 
 * Run with: medusa exec ./src/scripts/verify-tax-setup.ts
 */
export default async function verifyTaxSetup({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const taxModuleService = container.resolve(Modules.TAX)
  const regionModuleService = container.resolve(Modules.REGION)

  try {
    logger.info("🔍 Verifying VAT tax setup...\n")

    // 1. Check tax providers
    logger.info("1. Checking tax providers...")
    const taxProviders = await taxModuleService.listTaxProviders({})
    
    logger.info(`   Found ${taxProviders.length} tax provider(s):`)
    taxProviders.forEach(provider => {
      logger.info(`   - ${provider.id} ${provider.is_enabled ? '✓' : '✗ (disabled)'}`)
    })
    
    const vatTaxProvider = taxProviders.find(p => p.id.includes('vat_tax'))
    if (!vatTaxProvider) {
      logger.error("   ❌ VAT tax provider not found!")
      return
    }
    
    if (!vatTaxProvider.is_enabled) {
      logger.error("   ❌ VAT tax provider is disabled!")
      return
    }
    
    logger.info("   ✓ VAT tax provider is registered and enabled\n")

    // 2. Check regions
    logger.info("2. Checking regions...")
    const regions = await regionModuleService.listRegions({})
    
    logger.info(`   Found ${regions.length} region(s):`)
    regions.forEach(region => {
      logger.info(`   - ${region.name} (${region.currency_code})`)
    })
    
    const euRegion = regions.find(r => r.name.includes("Europe"))
    if (!euRegion) {
      logger.warn("   ⚠ No Europe region found!")
    } else {
      logger.info(`   ✓ Europe region found: ${euRegion.name}`)
      logger.info(`     - Currency: ${euRegion.currency_code}`)
      logger.info(`     - Countries: ${euRegion.countries?.length || 0}`)
      logger.info(`     - Tax inclusive: ${euRegion.metadata?.tax_inclusive_pricing ? 'Yes' : 'No'}`)
    }
    logger.info("")

    // 3. Check tax regions
    logger.info("3. Checking tax regions...")
    const taxRegions = await taxModuleService.listTaxRegions({})
    
    logger.info(`   Found ${taxRegions.length} tax region(s):`)
    
    const groupedByProvider: Record<string, string[]> = {}
    taxRegions.forEach(region => {
      const providerId = region.provider_id || 'none'
      if (!groupedByProvider[providerId]) {
        groupedByProvider[providerId] = []
      }
      groupedByProvider[providerId].push(region.country_code || 'unknown')
    })
    
    Object.entries(groupedByProvider).forEach(([providerId, countries]) => {
      logger.info(`   - ${providerId}: ${countries.length} countries`)
      if (providerId.includes('vat_tax')) {
        logger.info(`     ${countries.join(', ')}`)
      }
    })
    
    const vatTaxRegions = taxRegions.filter(r => r.provider_id?.includes('vat_tax'))
    if (vatTaxRegions.length === 0) {
      logger.error("   ❌ No tax regions using vat_tax provider!")
      return
    }
    
    logger.info(`   ✓ ${vatTaxRegions.length} tax regions using vat_tax provider\n`)

    // 4. Check NL (home country) configuration
    logger.info("4. Checking Netherlands (home country) configuration...")
    const nlTaxRegion = taxRegions.find(r => r.country_code === 'nl')
    
    if (!nlTaxRegion) {
      logger.error("   ❌ Netherlands tax region not found!")
      return
    }
    
    logger.info(`   ✓ Netherlands tax region found`)
    logger.info(`     - Provider: ${nlTaxRegion.provider_id}`)
    logger.info(`     - Is home country: ${nlTaxRegion.metadata?.is_home_country ? 'Yes' : 'No'}`)
    
    // Check tax rates for NL
    const nlTaxRates = await taxModuleService.listTaxRates({
      tax_region_id: nlTaxRegion.id,
    })
    
    if (nlTaxRates.length === 0) {
      logger.warn("   ⚠ No tax rates defined for Netherlands")
    } else {
      logger.info(`   ✓ ${nlTaxRates.length} tax rate(s) defined:`)
      nlTaxRates.forEach(rate => {
        logger.info(`     - ${rate.name}: ${rate.rate}% ${rate.is_default ? '(default)' : ''}`)
      })
    }
    logger.info("")

    // 5. Summary
    logger.info("=" .repeat(60))
    logger.info("Summary:")
    logger.info("=" .repeat(60))
    
    const euCountries = vatTaxRegions.filter(r => r.metadata?.is_eu)
    const homeCountry = vatTaxRegions.find(r => r.metadata?.is_home_country)
    
    logger.info(`✓ Tax provider: ${vatTaxProvider.id}`)
    logger.info(`✓ Home country: ${homeCountry?.country_code?.toUpperCase() || 'Not set'}`)
    logger.info(`✓ EU countries configured: ${euCountries.length}`)
    logger.info(`✓ Total tax regions: ${taxRegions.length}`)
    
    logger.info("\n✅ VAT tax setup verification complete!")
    logger.info("\nNext steps:")
    logger.info("1. Test checkout with different scenarios")
    logger.info("2. Run integration tests: bun run test:integration:http")
    logger.info("3. Check VAT calculations in Medusa Admin\n")

  } catch (error) {
    logger.error("❌ Error during verification:", error)
    throw error
  }
}


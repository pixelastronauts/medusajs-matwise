import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { 
  createRegionsWorkflow,
  createTaxRegionsWorkflow,
  createTaxRatesWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * Comprehensive Tax Setup Seeder for EU VAT Reverse Charge
 * 
 * This script sets up:
 * 1. Region with Netherlands as home country and EU countries
 * 2. Tax regions for each country using the vat_tax provider
 * 3. Tax rates (21% standard rate for NL)
 * 
 * Run with: bun run seed
 */
export default async function seedTaxSetup({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const regionModuleService = container.resolve(Modules.REGION)
  const taxModuleService = container.resolve(Modules.TAX)
  const storeModuleService = container.resolve(Modules.STORE)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)

  try {
    logger.info("🚀 Starting comprehensive tax setup...")

    // EU countries including Netherlands
    const euCountries = [
      'nl', // Netherlands (home country)
      'be', // Belgium
      'de', // Germany
      'fr', // France
      'es', // Spain
      'it', // Italy
      'at', // Austria
      'pt', // Portugal
      'ie', // Ireland
      'dk', // Denmark
      'se', // Sweden
      'fi', // Finland
      'pl', // Poland
      'cz', // Czech Republic
      'ro', // Romania
      'hu', // Hungary
      'gr', // Greece
      'bg', // Bulgaria
      'hr', // Croatia
      'sk', // Slovakia
      'si', // Slovenia
      'lt', // Lithuania
      'lv', // Latvia
      'ee', // Estonia
      'cy', // Cyprus
      'lu', // Luxembourg
      'mt', // Malta
    ]

    // Check if region already exists
    const existingRegions = await regionModuleService.listRegions({})

    let region
    if (existingRegions.length > 0) {
      // Use the first existing region (or find one by name if needed)
      region = existingRegions.find(r => r.name.includes("Europe")) || existingRegions[0]
      logger.info(`✓ Using existing region: ${region.name}`)
      
      // Update region metadata if needed
      await regionModuleService.updateRegions(region.id, {
        metadata: {
          ...region.metadata,
          tax_inclusive_pricing: true,
          home_country: 'nl',
        },
      })
      logger.info("✓ Updated region metadata")
    } else {
      logger.info("Creating Europe region with tax-inclusive pricing...")
      
      const { result: regionResult } = await createRegionsWorkflow(container).run({
        input: {
          regions: [
            {
              name: "Europe (EU)",
              currency_code: "eur",
              countries: euCountries,
              payment_providers: ["pp_system_default"],
              metadata: {
                tax_inclusive_pricing: true,
                home_country: 'nl',
              },
            },
          ],
        },
      })
      region = regionResult[0]
      logger.info(`✓ Created region: ${region.name}`)
    }

    // Update store with default settings
    const [store] = await storeModuleService.listStores()
    if (store) {
      logger.info("Updating store configuration...")
      
      let defaultSalesChannel = await salesChannelModuleService.listSalesChannels({
        name: "Default Sales Channel",
      })

      if (!defaultSalesChannel.length) {
        logger.error("No default sales channel found. Please run the main seed script first.")
      } else {
        await storeModuleService.updateStores(store.id, {
          supported_currencies: [
            {
              currency_code: "eur",
              is_default: true,
            },
          ],
          default_sales_channel_id: defaultSalesChannel[0].id,
          metadata: {
            home_country: 'nl',
            default_tax_rate: 21,
          },
        })
        logger.info("✓ Updated store configuration")
      }
    }

    // Get the vat_tax provider ID
    const taxProviders = await taxModuleService.listTaxProviders({})
    const vatTaxProvider = taxProviders.find(p => p.id.includes('vat_tax'))
    
    if (!vatTaxProvider) {
      logger.error("❌ VAT tax provider not found! Make sure it's registered in medusa-config.js")
      logger.info("Available providers:", taxProviders.map(p => p.id))
      throw new Error("VAT tax provider not registered")
    }
    
    logger.info(`✓ Found VAT tax provider: ${vatTaxProvider.id}`)

    // Create or update tax regions for each country
    logger.info(`Setting up tax regions for ${euCountries.length} countries...`)
    
    for (const countryCode of euCountries) {
      try {
        const existingTaxRegions = await taxModuleService.listTaxRegions({
          country_code: countryCode,
        })

        if (existingTaxRegions.length > 0 && existingTaxRegions[0]?.id) {
          // Update existing tax region
          const taxRegion = existingTaxRegions[0]
          await taxModuleService.updateTaxRegions(taxRegion.id, {
            provider_id: vatTaxProvider.id,
            metadata: {
              is_eu: true,
              is_home_country: countryCode.toLowerCase() === 'nl',
            },
          })
          logger.info(`  ✓ Updated tax region: ${countryCode.toUpperCase()}`)
        } else {
          // Create new tax region
          await createTaxRegionsWorkflow(container).run({
            input: [
              {
                country_code: countryCode,
                provider_id: vatTaxProvider.id,
                metadata: {
                  is_eu: true,
                  is_home_country: countryCode.toLowerCase() === 'nl',
                },
              },
            ],
          })
          logger.info(`  ✓ Created tax region: ${countryCode.toUpperCase()}`)
        }
      } catch (error) {
        logger.warn(`  ⚠ Could not setup tax region for ${countryCode.toUpperCase()}: ${error.message}`)
      }
    }

    // Create default tax rates for Netherlands (home country)
    logger.info("Setting up default tax rates for Netherlands...")
    
    const nlTaxRegion = await taxModuleService.listTaxRegions({
      country_code: 'nl',
    })

    if (nlTaxRegion.length > 0) {
      // Check if rates already exist
      const existingRates = await taxModuleService.listTaxRates({
        tax_region_id: nlTaxRegion[0].id,
      })

      if (existingRates.length === 0) {
        await createTaxRatesWorkflow(container).run({
          input: {
            tax_rates: [
              {
                tax_region_id: nlTaxRegion[0].id,
                name: "Standard Rate",
                code: "STANDARD",
                rate: 21,
                is_default: true,
                metadata: {
                  description: "Standard VAT rate for Netherlands",
                },
              },
              {
                tax_region_id: nlTaxRegion[0].id,
                name: "Reduced Rate",
                code: "REDUCED",
                rate: 9,
                is_default: false,
                metadata: {
                  description: "Reduced VAT rate for specific goods (food, books, etc.)",
                },
              },
              {
                tax_region_id: nlTaxRegion[0].id,
                name: "Zero Rate",
                code: "ZERO",
                rate: 0,
                is_default: false,
                metadata: {
                  description: "Zero rate for exports and specific services",
                },
              },
            ],
          },
        })
        logger.info("✓ Created tax rates for Netherlands")
      } else {
        logger.info("✓ Tax rates already exist for Netherlands")
      }
    }

    logger.info("\n✅ Tax setup completed successfully!")
    logger.info("\nConfiguration summary:")
    logger.info(`- Home country: Netherlands (NL)`)
    logger.info(`- EU countries configured: ${euCountries.length}`)
    logger.info(`- Tax provider: ${vatTaxProvider.id}`)
    logger.info(`- Standard tax rate: 21%`)
    logger.info(`- Tax-inclusive pricing: Enabled`)
    logger.info(`\nReverse charge rules:`)
    logger.info(`- NL domestic: 21% VAT applied`)
    logger.info(`- EU B2B with valid VAT: 0% (reverse charge)`)
    logger.info(`- EU B2C or invalid VAT: 21% VAT applied`)
    logger.info(`- Non-EU: 0% VAT\n`)

  } catch (error) {
    logger.error("❌ Error during tax setup:", error)
    throw error
  }
}


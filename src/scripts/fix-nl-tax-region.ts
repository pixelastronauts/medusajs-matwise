import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createTaxRegionsWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Fix Netherlands tax region
 * 
 * Run with: medusa exec ./src/scripts/fix-nl-tax-region.ts
 */
export default async function fixNlTaxRegion({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const taxModuleService = container.resolve(Modules.TAX)

  try {
    logger.info("🔧 Fixing Netherlands tax region...")

    // Get VAT tax provider
    const taxProviders = await taxModuleService.listTaxProviders({})
    const vatTaxProvider = taxProviders.find(p => p.id === 'tp_vat_tax_provider_vat_tax_provider')
    
    if (!vatTaxProvider) {
      logger.error("❌ VAT tax provider not found!")
      return
    }

    // Check NL tax region
    const nlTaxRegions = await taxModuleService.listTaxRegions({
      country_code: 'nl',
    })

    logger.info(`Found ${nlTaxRegions.length} NL tax region(s)`)

    // Check for corrupted regions (empty ID)
    const hasCorruptedRegion = nlTaxRegions.some(r => !r.id || r.id === '')
    
    if (hasCorruptedRegion || nlTaxRegions.length === 0) {
      logger.info("Netherlands tax region needs to be recreated...")
      
      // Delete all existing NL regions (including corrupted ones)
      for (const region of nlTaxRegions) {
        try {
          if (region.id && region.id !== '') {
            await taxModuleService.deleteTaxRegions(region.id)
            logger.info(`  Deleted region ${region.id}`)
          }
        } catch (e) {
          logger.warn(`  Could not delete region: ${e.message}`)
        }
      }
      
      // Create new NL tax region
      logger.info("Creating Netherlands tax region...")
      await createTaxRegionsWorkflow(container).run({
        input: [
          {
            country_code: 'nl',
            provider_id: vatTaxProvider.id,
            metadata: {
              is_eu: true,
              is_home_country: true,
            },
          },
        ],
      })
      logger.info("✓ Created Netherlands tax region")
    } else {
      // Update existing region if needed
      const nlRegion = nlTaxRegions[0]
      if (nlRegion.provider_id !== vatTaxProvider.id) {
        await taxModuleService.updateTaxRegions(nlRegion.id, {
          provider_id: vatTaxProvider.id,
          metadata: {
            is_eu: true,
            is_home_country: true,
          },
        })
        logger.info("✓ Updated Netherlands tax region to correct provider")
      } else {
        logger.info("✓ Netherlands tax region is already correctly configured")
      }
    }

    // Verify
    const verifyNl = await taxModuleService.listTaxRegions({
      country_code: 'nl',
    })
    
    if (verifyNl.length > 0 && verifyNl[0].id) {
      logger.info("\n✅ Netherlands tax region fixed!")
      logger.info(`   - ID: ${verifyNl[0].id}`)
      logger.info(`   - Provider: ${verifyNl[0].provider_id}`)
      logger.info(`   - Home country: ${verifyNl[0].metadata?.is_home_country}\n`)
    }

  } catch (error) {
    logger.error("❌ Error fixing NL tax region:", error)
    throw error
  }
}


import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * Script to update all existing tax regions to use the vat_tax provider
 * 
 * Run with: npx medusa exec ./src/scripts/update-tax-provider.ts
 */
export default async function updateTaxProvider({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const taxModuleService = container.resolve(Modules.TAX)

  try {
    logger.info("Updating tax regions to use vat_tax provider...")

    // Retrieve all tax regions
    const taxRegions = await taxModuleService.listTaxRegions({}, {})
    
    logger.info(`Found ${taxRegions.length} tax regions`)

    // Update each tax region to use the new provider
    for (const taxRegion of taxRegions) {
      await taxModuleService.updateTaxRegions(taxRegion.id, {
        provider_id: "vat_tax",
      })
      logger.info(`Updated tax region ${taxRegion.country_code} to use vat_tax provider`)
    }

    logger.info("✅ Successfully updated all tax regions to use vat_tax provider")
  } catch (error) {
    logger.error("Error updating tax regions:", error)
    throw error
  }
}


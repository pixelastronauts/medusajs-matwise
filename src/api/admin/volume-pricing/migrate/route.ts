import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { VOLUME_PRICING_MODULE, type VolumePricingService } from "../../../../modules/volume-pricing";

/**
 * POST /admin/volume-pricing/migrate
 * Migrate volume pricing from variant metadata to the new module
 * 
 * This is a one-time migration endpoint that reads volume_pricing_tiers
 * from variant metadata and creates proper VolumePriceTier records.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const volumePricingService = req.scope.resolve(VOLUME_PRICING_MODULE) as VolumePricingService;
  const productModuleService = req.scope.resolve(Modules.PRODUCT);

  const { product_id, dry_run = false } = req.body as {
    product_id?: string;
    dry_run?: boolean;
  };

  try {
    // Get all products or a specific one
    let products: any[];
    
    if (product_id) {
      const product = await productModuleService.retrieveProduct(product_id, {
        relations: ["variants"],
      });
      products = product ? [product] : [];
    } else {
      products = await productModuleService.listProducts(
        {},
        { relations: ["variants"] }
      );
    }

    const migrationResults: any[] = [];
    let totalMigrated = 0;
    let totalSkipped = 0;

    for (const product of products) {
      for (const variant of product.variants || []) {
        const volumeTiers = variant.metadata?.volume_pricing_tiers as any[] | undefined;
        
        if (!volumeTiers || !Array.isArray(volumeTiers) || volumeTiers.length === 0) {
          totalSkipped++;
          continue;
        }

        // Check if already migrated
        const existingTiersResult = await volumePricingService.getTiersForVariant(variant.id);
        
        if (existingTiersResult.tiers.length > 0) {
          migrationResults.push({
            variant_id: variant.id,
            variant_title: variant.title,
            product_title: product.title,
            status: "skipped",
            reason: "Already has tiers in new module",
            existing_tier_count: existingTiersResult.tiers.length,
          });
          totalSkipped++;
          continue;
        }

        if (dry_run) {
          migrationResults.push({
            variant_id: variant.id,
            variant_title: variant.title,
            product_title: product.title,
            status: "would_migrate",
            tiers: volumeTiers,
          });
          totalMigrated++;
          continue;
        }

        // Migrate the tiers
        await volumePricingService.migrateFromMetadata(variant.id, volumeTiers);
        
        migrationResults.push({
          variant_id: variant.id,
          variant_title: variant.title,
          product_title: product.title,
          status: "migrated",
          tier_count: volumeTiers.length,
        });
        
        totalMigrated++;
      }
    }

    res.json({
      success: true,
      dry_run,
      summary: {
        total_products: products.length,
        total_variants_migrated: totalMigrated,
        total_variants_skipped: totalSkipped,
      },
      results: migrationResults,
    });
  } catch (error: any) {
    console.error("Error during volume pricing migration:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /admin/volume-pricing/migrate
 * Get migration status (what would be migrated)
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const volumePricingService = req.scope.resolve(VOLUME_PRICING_MODULE) as VolumePricingService;
  const productModuleService = req.scope.resolve(Modules.PRODUCT);

  try {
    const products = await productModuleService.listProducts(
      {},
      { relations: ["variants"] }
    );

    const status: any[] = [];
    let needsMigration = 0;
    let alreadyMigrated = 0;
    let noTiers = 0;

    for (const product of products) {
      for (const variant of product.variants || []) {
        const volumeTiers = variant.metadata?.volume_pricing_tiers as any[] | undefined;
        const existingTiersResult = await volumePricingService.getTiersForVariant(variant.id);

        if (existingTiersResult.tiers.length > 0) {
          status.push({
            variant_id: variant.id,
            variant_title: variant.title,
            product_title: product.title,
            status: "migrated",
            new_module_tier_count: existingTiersResult.tiers.length,
            metadata_tier_count: volumeTiers?.length || 0,
          });
          alreadyMigrated++;
        } else if (volumeTiers && volumeTiers.length > 0) {
          status.push({
            variant_id: variant.id,
            variant_title: variant.title,
            product_title: product.title,
            status: "needs_migration",
            metadata_tier_count: volumeTiers.length,
          });
          needsMigration++;
        } else {
          noTiers++;
        }
      }
    }

    res.json({
      summary: {
        total_products: products.length,
        needs_migration: needsMigration,
        already_migrated: alreadyMigrated,
        no_tiers: noTiers,
      },
      variants: status,
    });
  } catch (error: any) {
    console.error("Error checking migration status:", error);
    res.status(500).json({ message: error.message });
  }
};


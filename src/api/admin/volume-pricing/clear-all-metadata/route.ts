import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";

// POST /admin/volume-pricing/clear-all-metadata
// Clear legacy volume_pricing_tiers from all variants of a product (or all products)
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { product_id } = req.body as { product_id?: string };

  try {
    const productModuleService = req.scope.resolve(Modules.PRODUCT);

    let variantsCleared = 0;
    let variantsSkipped = 0;

    if (product_id) {
      // Clear for specific product
      const product = await productModuleService.retrieveProduct(product_id, {
        relations: ["variants"],
      });

      for (const variant of product.variants || []) {
        const metadata = variant.metadata || {};
        if (metadata.volume_pricing_tiers) {
          const { volume_pricing_tiers, ...newMetadata } = metadata;
          await productModuleService.updateProductVariants(variant.id, {
            metadata: newMetadata,
          });
          variantsCleared++;
        } else {
          variantsSkipped++;
        }
      }
    } else {
      // Clear for ALL products
      const products = await productModuleService.listProducts({}, {
        relations: ["variants"],
      });

      for (const product of products) {
        for (const variant of product.variants || []) {
          const metadata = variant.metadata || {};
          if (metadata.volume_pricing_tiers) {
            const { volume_pricing_tiers, ...newMetadata } = metadata;
            await productModuleService.updateProductVariants(variant.id, {
              metadata: newMetadata,
            });
            variantsCleared++;
          } else {
            variantsSkipped++;
          }
        }
      }
    }

    res.json({
      success: true,
      message: `Cleared legacy metadata tiers from ${variantsCleared} variant(s)`,
      variants_cleared: variantsCleared,
      variants_skipped: variantsSkipped,
    });
  } catch (error: any) {
    console.error("Error clearing metadata tiers:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clear metadata tiers",
      error: error.message,
    });
  }
};


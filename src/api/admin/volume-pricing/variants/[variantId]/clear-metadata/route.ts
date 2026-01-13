import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";

// DELETE /admin/volume-pricing/variants/:variantId/clear-metadata
// Remove legacy volume_pricing_tiers from variant metadata
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const { variantId } = req.params;

  try {
    const productModuleService = req.scope.resolve(Modules.PRODUCT);

    // Get the variant
    const variant = await productModuleService.retrieveProductVariant(variantId, {
      select: ["id", "metadata"],
    });

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "Variant not found",
      });
    }

    const currentMetadata = variant.metadata || {};
    const hadTiers = !!currentMetadata.volume_pricing_tiers;
    const oldTiers = currentMetadata.volume_pricing_tiers;

    // Remove volume_pricing_tiers from metadata
    const { volume_pricing_tiers, ...newMetadata } = currentMetadata;

    await productModuleService.updateProductVariants(variantId, {
      metadata: newMetadata,
    });

    res.json({
      success: true,
      message: hadTiers
        ? "Removed legacy volume_pricing_tiers from variant metadata"
        : "Variant had no legacy volume_pricing_tiers",
      removed_tiers: oldTiers || null,
    });
  } catch (error: any) {
    console.error("Error clearing variant metadata tiers:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clear metadata tiers",
      error: error.message,
    });
  }
};








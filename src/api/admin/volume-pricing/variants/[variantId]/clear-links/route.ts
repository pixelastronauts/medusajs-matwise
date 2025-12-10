import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { VOLUME_PRICING_MODULE, type VolumePricingService } from "../../../../../../modules/volume-pricing";

// DELETE /admin/volume-pricing/variants/:variantId/clear-links
// Remove all price list links from a variant
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const { variantId } = req.params;

  try {
    const volumePricingService = req.scope.resolve(VOLUME_PRICING_MODULE) as VolumePricingService;

    // Get all links for this variant
    const links = await volumePricingService.listVolumePriceListVariants({
      variant_id: variantId,
    });

    if (links.length === 0) {
      return res.json({
        success: true,
        message: "No price list links found for this variant",
        removed_count: 0,
      });
    }

    // Delete all links
    await volumePricingService.deleteVolumePriceListVariants(
      links.map((l: any) => l.id)
    );

    res.json({
      success: true,
      message: `Removed ${links.length} price list link(s) from variant`,
      removed_count: links.length,
      removed_price_list_ids: links.map((l: any) => l.price_list_id),
    });
  } catch (error: any) {
    console.error("Error clearing variant price list links:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clear price list links",
      error: error.message,
    });
  }
};


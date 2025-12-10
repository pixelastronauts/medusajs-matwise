import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { VOLUME_PRICING_MODULE, type VolumePricingService } from "../../../../../../modules/volume-pricing";

/**
 * POST /admin/volume-pricing/price-lists/:id/duplicate
 * Duplicate a volume price list with its tiers (optionally with variants)
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const volumePricingService = req.scope.resolve(VOLUME_PRICING_MODULE) as VolumePricingService;
  const { id } = req.params;

  const { 
    name,
    include_variants = false,
  } = req.body as {
    name?: string;
    include_variants?: boolean;
  };

  try {
    // Get the original price list with tiers
    const original = await volumePricingService.getPriceListWithTiers(id);
    
    if (!original) {
      return res.status(404).json({ message: "Price list not found" });
    }

    // Get original variants if needed
    let originalVariantIds: string[] = [];
    if (include_variants) {
      originalVariantIds = await volumePricingService.getVariantsForPriceList(id);
    }

    // Create the duplicate
    const duplicateName = name || `${original.name} (Copy)`;
    
    const duplicate = await volumePricingService.createPriceList({
      name: duplicateName,
      description: original.description,
      type: (original.type as "default" | "customer_group" | "sale") || "default",
      status: "draft", // Always create as draft
      starts_at: original.starts_at,
      ends_at: original.ends_at,
      customer_group_ids: Array.isArray(original.customer_group_ids) ? original.customer_group_ids as string[] : [],
      customer_ids: Array.isArray(original.customer_ids) ? original.customer_ids as string[] : [],
      priority: original.priority,
      currency_code: original.currency_code,
      tiers: original.tiers?.map((tier: any) => ({
        min_quantity: tier.min_quantity,
        max_quantity: tier.max_quantity,
        price_per_sqm: tier.price_per_sqm, // Already in cents from getPriceListWithTiers
      })) || [],
    });

    // Attach variants if requested
    if (include_variants && originalVariantIds.length > 0) {
      await volumePricingService.attachVariantsToPriceList(duplicate.id, originalVariantIds);
    }

    // Return the new duplicate with its tiers
    const duplicateWithTiers = await volumePricingService.getPriceListWithTiers(duplicate.id);
    const duplicateVariantIds = include_variants ? originalVariantIds : [];

    res.json({
      price_list: duplicateWithTiers,
      variant_ids: duplicateVariantIds,
      original_id: id,
    });
  } catch (error: any) {
    console.error("Error duplicating volume price list:", error);
    res.status(500).json({ message: error.message });
  }
};


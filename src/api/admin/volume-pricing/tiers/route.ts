import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { VOLUME_PRICING_MODULE, type VolumePricingService } from "../../../../modules/volume-pricing";

/**
 * GET /admin/volume-pricing/tiers
 * List all volume price tiers, optionally filtered by variant_id and/or price_list_id
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const volumePricingService = req.scope.resolve(VOLUME_PRICING_MODULE) as VolumePricingService;
  
  const { variant_id, variant_ids, price_list_id } = req.query as {
    variant_id?: string;
    variant_ids?: string;
    price_list_id?: string;
  };

  try {
    let tiers: any[];

    if (variant_ids) {
      // Multiple variants - get tiers for each variant
      const ids = variant_ids.split(",");
      const priceListId = price_list_id === "null" ? null : price_list_id;
      const allTiers: any[] = [];
      
      for (const variantId of ids) {
        if (priceListId) {
          const variantTiers = await volumePricingService.getTiersForPriceListAndVariant(priceListId, variantId);
          allTiers.push(...variantTiers);
        } else {
          const result = await volumePricingService.getTiersForVariant(variantId);
          allTiers.push(...result.tiers);
        }
      }
      tiers = allTiers;
    } else if (variant_id) {
      // Single variant
      const priceListId = price_list_id === "null" ? null : price_list_id;
      if (priceListId) {
        tiers = await volumePricingService.getTiersForPriceListAndVariant(priceListId, variant_id);
      } else {
        const result = await volumePricingService.getTiersForVariant(variant_id);
        tiers = result.tiers;
      }
    } else {
      // All tiers
      const filters: any = {};
      if (price_list_id !== undefined) {
        filters.price_list_id = price_list_id === "null" ? null : price_list_id;
      }
      tiers = await volumePricingService.listVolumePriceTiers(filters);
    }

    res.json({
      tiers: tiers.map((tier: any) => ({
        ...tier,
        // Convert price_per_sqm from cents to euros for display
        price_per_sqm_display: Number(tier.price_per_sqm) / 100,
      })),
    });
  } catch (error: any) {
    console.error("Error listing volume price tiers:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * POST /admin/volume-pricing/tiers
 * Create a new volume price tier
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const volumePricingService = req.scope.resolve(VOLUME_PRICING_MODULE) as VolumePricingService;
  
  const {
    variant_id,
    price_list_id,
    min_quantity,
    max_quantity,
    price_per_sqm,
    currency_code,
  } = req.body as {
    variant_id: string;
    price_list_id?: string | null;
    min_quantity: number;
    max_quantity?: number | null;
    price_per_sqm: number; // Expected in euros, will convert to cents
    currency_code?: string;
  };

  if (!variant_id) {
    return res.status(400).json({ message: "variant_id is required" });
  }

  if (price_per_sqm === undefined || price_per_sqm === null) {
    return res.status(400).json({ message: "price_per_sqm is required" });
  }

  try {
    // Create the tier using the base service method
    const tier = await volumePricingService.createVolumePriceTiers({
      price_list_id: price_list_id || null,
      min_quantity: min_quantity || 1,
      max_quantity: max_quantity ?? null,
      price_per_sqm: Math.round(price_per_sqm * 100), // Convert to cents
    });

    // If variant_id provided, link it to a price list
    // Note: In the new architecture, tiers belong to price lists, not directly to variants
    // Variants are linked to price lists via VolumePriceListVariant

    res.status(201).json({
      tier: {
        ...tier,
        price_per_sqm_display: Number(tier.price_per_sqm) / 100,
      },
    });
  } catch (error: any) {
    console.error("Error creating volume price tier:", error);
    res.status(500).json({ message: error.message });
  }
};


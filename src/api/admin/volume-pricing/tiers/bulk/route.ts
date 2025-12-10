import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { VOLUME_PRICING_MODULE, type VolumePricingService } from "../../../../../modules/volume-pricing";

type TierInput = {
  min_quantity: number;
  max_quantity?: number | null;
  price_per_sqm: number; // in euros
};

type BulkSetInput = {
  variant_id: string;
  tiers: TierInput[];
};

/**
 * POST /admin/volume-pricing/tiers/bulk
 * Bulk set tiers for multiple variants
 * This replaces all existing tiers for the specified variants
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const volumePricingService = req.scope.resolve(VOLUME_PRICING_MODULE) as VolumePricingService;

  const { data, price_list_id } = req.body as {
    data: BulkSetInput[];
    price_list_id?: string | null;
  };

  if (!data || !Array.isArray(data)) {
    return res.status(400).json({ message: "data array is required" });
  }

  try {
    const results: { variant_id: string; tiers: any[] }[] = [];

    // Process each variant's tiers
    for (const item of data) {
      // If price_list_id is provided, set tiers for that price list
      // Otherwise, get or create a default price list for the variant
      if (price_list_id) {
        // Ensure variant is linked to the price list
        await volumePricingService.attachVariantsToPriceList(price_list_id, [item.variant_id]);
        
        // Set tiers for the price list
        const tiers = await volumePricingService.setTiersForPriceList(
          price_list_id,
          item.tiers.map((tier) => ({
            min_quantity: tier.min_quantity,
            max_quantity: tier.max_quantity ?? null,
            price_per_sqm: Math.round(tier.price_per_sqm * 100), // Convert euros to cents
          }))
        );

        results.push({
          variant_id: item.variant_id,
          tiers: Array.isArray(tiers) ? tiers : [],
        });
      } else {
        // Create a new price list for this variant
        const priceList = await volumePricingService.createPriceList({
          name: `Variant Pricing (${item.variant_id.slice(-6)})`,
          description: "Auto-created from bulk set",
          type: "default",
          status: "active",
          tiers: item.tiers.map((tier) => ({
            min_quantity: tier.min_quantity,
            max_quantity: tier.max_quantity ?? null,
            price_per_sqm: Math.round(tier.price_per_sqm * 100),
          })),
        });

        // Link variant to price list
        await volumePricingService.attachVariantsToPriceList(priceList.id, [item.variant_id]);

        // Get the created tiers
        const tiers = await volumePricingService.getTiersForPriceList(priceList.id);

        results.push({
          variant_id: item.variant_id,
          tiers: Array.isArray(tiers) ? tiers : [],
        });
      }
    }

    res.json({
      results: results.map((r) => ({
        variant_id: r.variant_id,
        tiers: r.tiers.map((t: any) => ({
          ...t,
          price_per_sqm_display: Number(t.price_per_sqm) / 100,
        })),
      })),
    });
  } catch (error: any) {
    console.error("Error bulk setting volume price tiers:", error);
    res.status(500).json({ message: error.message });
  }
};


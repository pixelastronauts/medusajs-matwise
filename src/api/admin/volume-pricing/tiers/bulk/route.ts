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
    const results = await volumePricingService.bulkSetTiers(
      data.map((item) => ({
        variant_id: item.variant_id,
        tiers: item.tiers.map((tier) => ({
          min_quantity: tier.min_quantity,
          max_quantity: tier.max_quantity ?? null,
          price_per_sqm: Math.round(tier.price_per_sqm * 100), // Convert euros to cents
          currency_code: "eur",
        })),
      })),
      price_list_id ?? null
    );

    res.json({
      results: results.map((r) => ({
        variant_id: r.variant_id,
        tiers: Array.isArray(r.tiers)
          ? r.tiers.map((t: any) => ({
              ...t,
              price_per_sqm_display: Number(t.price_per_sqm) / 100,
            }))
          : [],
      })),
    });
  } catch (error: any) {
    console.error("Error bulk setting volume price tiers:", error);
    res.status(500).json({ message: error.message });
  }
};


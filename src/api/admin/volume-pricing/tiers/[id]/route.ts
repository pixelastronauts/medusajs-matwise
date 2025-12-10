import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { VOLUME_PRICING_MODULE, type VolumePricingService } from "../../../../../modules/volume-pricing";

/**
 * GET /admin/volume-pricing/tiers/:id
 * Get a single volume price tier
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const volumePricingService = req.scope.resolve(VOLUME_PRICING_MODULE) as VolumePricingService;
  const { id } = req.params;

  try {
    const tier = await volumePricingService.retrieveVolumePriceTier(id);

    if (!tier) {
      return res.status(404).json({ message: "Tier not found" });
    }

    res.json({
      tier: {
        ...tier,
        price_per_sqm_display: Number(tier.price_per_sqm) / 100,
      },
    });
  } catch (error: any) {
    console.error("Error retrieving volume price tier:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * POST /admin/volume-pricing/tiers/:id
 * Update a volume price tier
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const volumePricingService = req.scope.resolve(VOLUME_PRICING_MODULE) as VolumePricingService;
  const { id } = req.params;

  const {
    min_quantity,
    max_quantity,
    price_per_sqm,
    currency_code,
    priority,
  } = req.body as {
    min_quantity?: number;
    max_quantity?: number | null;
    price_per_sqm?: number; // Expected in euros
    currency_code?: string;
    priority?: number;
  };

  try {
    const updateData: any = {};
    
    if (min_quantity !== undefined) updateData.min_quantity = min_quantity;
    if (max_quantity !== undefined) updateData.max_quantity = max_quantity;
    if (price_per_sqm !== undefined) updateData.price_per_sqm = Math.round(price_per_sqm * 100);
    if (currency_code !== undefined) updateData.currency_code = currency_code;
    if (priority !== undefined) updateData.priority = priority;

    const tier = await volumePricingService.updateVolumePriceTiers({ id, ...updateData });

    res.json({
      tier: {
        ...tier,
        price_per_sqm_display: Number(tier.price_per_sqm) / 100,
      },
    });
  } catch (error: any) {
    console.error("Error updating volume price tier:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * DELETE /admin/volume-pricing/tiers/:id
 * Delete a volume price tier
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const volumePricingService = req.scope.resolve(VOLUME_PRICING_MODULE) as VolumePricingService;
  const { id } = req.params;

  try {
    await volumePricingService.deleteVolumePriceTiers(id);
    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Error deleting volume price tier:", error);
    res.status(500).json({ message: error.message });
  }
};


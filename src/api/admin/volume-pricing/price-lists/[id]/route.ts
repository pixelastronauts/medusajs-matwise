import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { VOLUME_PRICING_MODULE, type VolumePricingService } from "../../../../../modules/volume-pricing";

/**
 * GET /admin/volume-pricing/price-lists/:id
 * Get a single volume price list with its tiers and variants
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const volumePricingService = req.scope.resolve(VOLUME_PRICING_MODULE) as VolumePricingService;
  const { id } = req.params;

  try {
    const priceListWithTiers = await volumePricingService.getPriceListWithTiers(id);
    const variantIds = await volumePricingService.getVariantsForPriceList(id);

    if (!priceListWithTiers) {
      return res.status(404).json({ message: "Price list not found" });
    }

    res.json({
      price_list: priceListWithTiers,
      variant_ids: variantIds,
    });
  } catch (error: any) {
    console.error("Error retrieving volume price list:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * PUT/POST /admin/volume-pricing/price-lists/:id
 * Update a volume price list
 */
const updatePriceList = async (req: MedusaRequest, res: MedusaResponse) => {
  const volumePricingService = req.scope.resolve(VOLUME_PRICING_MODULE) as VolumePricingService;
  const { id } = req.params;

  const {
    name,
    description,
    type,
    status,
    starts_at,
    ends_at,
    customer_group_ids,
    customer_ids,
    priority,
    currency_code,
    tiers,
    variant_ids,
  } = req.body as {
    name?: string;
    description?: string | null;
    type?: "default" | "customer_group" | "sale";
    status?: "active" | "draft";
    starts_at?: string | null;
    ends_at?: string | null;
    customer_group_ids?: string[];
    customer_ids?: string[];
    priority?: number;
    currency_code?: string;
    tiers?: { min_quantity: number; max_quantity?: number | null; price_per_sqm: number; requires_login?: boolean }[];
    variant_ids?: string[];
  };

  try {
    const updateData: any = {};
    
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (type !== undefined) updateData.type = type;
    if (status !== undefined) updateData.status = status;
    if (starts_at !== undefined) updateData.starts_at = starts_at ? new Date(starts_at) : null;
    if (ends_at !== undefined) updateData.ends_at = ends_at ? new Date(ends_at) : null;
    if (priority !== undefined) updateData.priority = priority;
    if (currency_code !== undefined) updateData.currency_code = currency_code;

    // For "default" type, always clear customer groups (they have no effect)
    if (type === "default") {
      updateData.customer_group_ids = [];
      updateData.customer_ids = [];
    } else {
      if (customer_group_ids !== undefined) updateData.customer_group_ids = customer_group_ids;
      if (customer_ids !== undefined) updateData.customer_ids = customer_ids;
    }

    const priceList = await volumePricingService.updatePriceList(id, updateData);

    // Update tiers if provided
    if (tiers !== undefined) {
      await volumePricingService.setTiersForPriceList(
        id,
        tiers.map((t) => ({
          min_quantity: t.min_quantity,
          max_quantity: t.max_quantity ?? null,
          price_per_sqm: Math.round(t.price_per_sqm * 100), // Convert euros to cents
          requires_login: t.requires_login || false,
        }))
      );
    }

    // Update variants if provided
    if (variant_ids !== undefined) {
      await volumePricingService.setVariantsForPriceList(id, variant_ids);
    }

    res.json({ price_list: priceList });
  } catch (error: any) {
    console.error("Error updating volume price list:", error);
    res.status(500).json({ message: error.message });
  }
};

// Export both PUT and POST for the update endpoint
export const PUT = updatePriceList;
export const POST = updatePriceList;

/**
 * DELETE /admin/volume-pricing/price-lists/:id
 * Delete a volume price list
 */
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const volumePricingService = req.scope.resolve(VOLUME_PRICING_MODULE) as VolumePricingService;
  const { id } = req.params;

  try {
    await volumePricingService.deletePriceList(id);
    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Error deleting volume price list:", error);
    res.status(500).json({ message: error.message });
  }
};

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { VOLUME_PRICING_MODULE, type VolumePricingService } from "../../../../modules/volume-pricing";

/**
 * GET /admin/volume-pricing/price-lists
 * List all volume price lists
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const volumePricingService = req.scope.resolve(VOLUME_PRICING_MODULE) as VolumePricingService;

  const { status, type } = req.query as { status?: string; type?: string };

  try {
    const filters: any = {};
    if (status) filters.status = status;
    if (type) filters.type = type;

    const priceLists = await volumePricingService.listPriceLists(filters);

    // Get tier counts and variant counts for each list
    const priceListsWithCounts = await Promise.all(
      priceLists.map(async (pl: any) => {
        const tiers = await volumePricingService.getTiersForPriceList(pl.id);
        const variantIds = await volumePricingService.getVariantsForPriceList(pl.id);
        
        return {
          ...pl,
          tier_count: tiers.length,
          variant_count: variantIds.length,
        };
      })
    );

    res.json({ price_lists: priceListsWithCounts });
  } catch (error: any) {
    console.error("Error listing volume price lists:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * POST /admin/volume-pricing/price-lists
 * Create a new volume price list with tiers
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const volumePricingService = req.scope.resolve(VOLUME_PRICING_MODULE) as VolumePricingService;

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
    name: string;
    description?: string;
    type?: "default" | "customer_group" | "sale";
    status?: "active" | "draft";
    starts_at?: string;
    ends_at?: string;
    customer_group_ids?: string[];
    customer_ids?: string[];
    priority?: number;
    currency_code?: string;
    tiers?: { min_quantity: number; max_quantity?: number | null; price_per_sqm: number; requires_login?: boolean }[];
    variant_ids?: string[];
  };

  if (!name) {
    return res.status(400).json({ message: "name is required" });
  }

  try {
    const priceListType = type || "default";
    
    const priceList = await volumePricingService.createPriceList({
      name,
      description: description || null,
      type: priceListType,
      status: status || "draft",
      starts_at: starts_at ? new Date(starts_at) : null,
      ends_at: ends_at ? new Date(ends_at) : null,
      // For "default" type, ignore customer groups (they have no effect)
      customer_group_ids: priceListType === "default" ? [] : (customer_group_ids || []),
      customer_ids: priceListType === "default" ? [] : (customer_ids || []),
      priority: priority || 0,
      currency_code: currency_code || "eur",
      tiers: tiers?.map((t) => ({
        min_quantity: t.min_quantity,
        max_quantity: t.max_quantity ?? null,
        price_per_sqm: Math.round(t.price_per_sqm * 100), // Convert euros to cents
        requires_login: t.requires_login || false,
      })),
    });

    // Attach variants if provided
    if (variant_ids && variant_ids.length > 0) {
      await volumePricingService.attachVariantsToPriceList(priceList.id, variant_ids);
    }

    res.status(201).json({ price_list: priceList });
  } catch (error: any) {
    console.error("Error creating volume price list:", error);
    res.status(500).json({ message: error.message });
  }
};

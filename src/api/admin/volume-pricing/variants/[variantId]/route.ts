import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

/**
 * GET /admin/volume-pricing/variants/:variantId
 * Get all volume price lists attached to a variant with their tiers
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const volumePricingService = req.scope.resolve("volumePricing") as any;
  const { variantId } = req.params;

  try {
    // Get all price lists for this variant
    const priceLists = await volumePricingService.getPriceListsForVariant(variantId);
    
    // Enrich each price list with its tiers
    const priceListsWithTiers = await Promise.all(
      priceLists.map(async (pl: any) => {
        const tiers = await volumePricingService.getTiersForPriceList(pl.id);
        return {
          ...pl,
          tiers: tiers.map((tier: any) => ({
            ...tier,
            price_per_sqm_display: Number(tier.price_per_sqm) / 100,
          })).sort((a: any, b: any) => (a.min_quantity || 0) - (b.min_quantity || 0)),
        };
      })
    );

    // Sort by priority (highest first) and determine which is active
    const sortedPriceLists = priceListsWithTiers.sort((a: any, b: any) => 
      (b.priority || 0) - (a.priority || 0)
    );

    // Find the "active" price list (highest priority, active status, default type, no restrictions)
    const now = new Date();
    const activePriceList = sortedPriceLists.find((pl: any) => {
      if (pl.status !== "active") return false;
      if (pl.type !== "default") return false;
      if (pl.starts_at && new Date(pl.starts_at) > now) return false;
      if (pl.ends_at && new Date(pl.ends_at) < now) return false;
      const hasCustomerRestrictions = 
        (pl.customer_group_ids?.length > 0) || 
        (pl.customer_ids?.length > 0);
      if (hasCustomerRestrictions) return false;
      return true;
    });

    res.json({
      variant_id: variantId,
      price_lists: sortedPriceLists,
      active_price_list: activePriceList || null,
      active_price_list_id: activePriceList?.id || null,
    });
  } catch (error: any) {
    console.error("Error fetching price lists for variant:", error);
    res.status(500).json({ 
      message: error.message,
      variant_id: variantId,
      price_lists: [],
      active_price_list: null,
    });
  }
};


import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { VOLUME_PRICING_MODULE, type VolumePricingService } from "../../../../../modules/volume-pricing";
import { fromPriceCache, FROM_PRICE_CACHE_TTL } from "../../../../../utils/price-cache";

const CACHE_TTL = FROM_PRICE_CACHE_TTL;

// Handle CORS preflight
export const OPTIONS = async (req: MedusaRequest, res: MedusaResponse) => {
  res.status(200).end();
};

// GET /store/products/:id/from-price
// Get the "from price" for a product (minimum dimensions, cheapest material)
// Uses authenticated customer for customer-specific pricing
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const productId = req.params.id;

  // Get authenticated customer ID
  const customerId = (req as any).auth_context?.actor_id;

  try {
    const productModuleService = req.scope.resolve(Modules.PRODUCT);
    const customerModuleService = req.scope.resolve(Modules.CUSTOMER);
    const pricingFormulaService = req.scope.resolve("pricingFormulaModuleService") as any;
    const volumePricingService = req.scope.resolve(VOLUME_PRICING_MODULE) as VolumePricingService;

    // Get customer's groups if authenticated
    let customerGroupIds: string[] = [];
    if (customerId) {
      try {
        const customerGroups = await customerModuleService.listCustomerGroups({
          customers: customerId,
        });
        customerGroupIds = customerGroups.map((g: any) => g.id);
      } catch {
        // Ignore errors fetching groups
      }
    }

    // Cache key based on customer groups (customers in same groups get same price)
    const groupsKey = customerGroupIds.length > 0 ? customerGroupIds.sort().join(",") : "default";
    const cacheKey = `${productId}:${groupsKey}`;

    // Check cache first
    const cached = fromPriceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return res.json({
        from_price: cached.price,
        cached: true,
      });
    }

    // Retrieve product with variants
    const product = await productModuleService.retrieveProduct(productId, {
      select: ["id", "metadata"],
      relations: ["variants"],
    });

    const formulaId = product.metadata?.pricing_formula_id as string | undefined;

    console.log(`[FROM PRICE] Product ${productId}, formula ID:`, formulaId, `customer: ${customerId}, groups: ${customerGroupIds.join(",")}`);

    // Helper function to get price per sqm for a variant (using volume pricing module only)
    const getPricePerSqmForVariant = async (variantId: string) => {
      const volumePriceResult = await volumePricingService.findApplicablePricePerSqm(
        variantId,
        1,
        { 
          customerId: customerId,
          customerGroupIds: customerGroupIds,
          currencyCode: "eur" 
        }
      );

      if (volumePriceResult) {
        return volumePriceResult.price_per_sqm / 100; // Convert from cents
      }

      // No volume pricing found - use default fallback
      return 120.0;
    };

    if (!formulaId) {
      console.log("[FROM PRICE] No formula found, using simple sqm calculation");
      // No formula, use simple sqm calculation fallback
      // Find cheapest material (first tier)
      let cheapestPricePerSqm = 120.0;

      for (const variant of product.variants || []) {
        if (variant.metadata?.custom === true) continue;
        
        const pricePerSqm = await getPricePerSqmForVariant(variant.id);
        
        if (pricePerSqm < cheapestPricePerSqm) {
          cheapestPricePerSqm = pricePerSqm;
        }
      }

      const minSqm = 0.09; // 30cm × 30cm = 0.09 m²
      const fromPrice = Math.floor(minSqm * cheapestPricePerSqm);

      // Cache the result
      fromPriceCache.set(cacheKey, {
        price: fromPrice,
        timestamp: Date.now(),
      });

      return res.json({
        from_price: fromPrice,
        cached: false,
      });
    }

    // Use formula - find cheapest material
    let cheapestPrice = Infinity;

    for (const variant of product.variants || []) {
      if (variant.metadata?.custom === true) continue;

      const pricePerSqm = await getPricePerSqmForVariant(variant.id);

      // Calculate price with formula for this material
      const calculatedPrice = await pricingFormulaService.calculatePrice(
        formulaId,
        {
          width_value: 30,
          length_value: 30,
          price_per_sqm: pricePerSqm,
        }
      );

      if (calculatedPrice < cheapestPrice) {
        cheapestPrice = calculatedPrice;
      }
    }

    const fromPrice = cheapestPrice !== Infinity ? cheapestPrice : Math.floor(0.09 * 120.0);

    // Cache the result
    fromPriceCache.set(cacheKey, {
      price: fromPrice,
      timestamp: Date.now(),
    });

    // Clean up old cache entries
    if (fromPriceCache.size > 1000) {
      const now = Date.now();
      for (const [key, value] of fromPriceCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
          fromPriceCache.delete(key);
        }
      }
    }

    res.json({
      from_price: fromPrice,
      cached: false,
    });
  } catch (error: any) {
    console.error("Error calculating from price:", error);
    res.status(500).json({
      message: "Failed to calculate from price",
      error: error.message,
    });
  }
};


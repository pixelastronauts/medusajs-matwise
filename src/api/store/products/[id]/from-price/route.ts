import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";

// Heavy caching for "from price" - rarely changes
const fromPriceCache = new Map<string, { price: number; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Handle CORS preflight
export const OPTIONS = async (req: MedusaRequest, res: MedusaResponse) => {
  res.status(200).end();
};

// GET /store/products/:id/from-price
// Get the "from price" for a product (minimum dimensions, cheapest material)
// Heavily cached for SEO and performance
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const productId = req.params.id;

  // Check cache first
  const cached = fromPriceCache.get(productId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return res.json({
      from_price: cached.price,
      cached: true,
      dimensions: { width_cm: 30, height_cm: 30, sqm: 0.09 },
    });
  }

  try {
    const productModuleService = req.scope.resolve(Modules.PRODUCT);
    const pricingFormulaService = req.scope.resolve("pricingFormulaModuleService") as any;

    // Retrieve product with variants
    const product = await productModuleService.retrieveProduct(productId, {
      select: ["id", "metadata"],
      relations: ["variants"],
    });

    const formulaId = product.metadata?.pricing_formula_id as string | undefined;

    console.log(`[FROM PRICE] Product ${productId}, formula ID:`, formulaId);

    if (!formulaId) {
      console.log("[FROM PRICE] No formula found, using simple sqm calculation");
      // No formula, use simple sqm calculation fallback
      // Find cheapest material (first tier)
      let cheapestPricePerSqm = 120.0;

      for (const variant of product.variants || []) {
        if (variant.metadata?.custom === true) continue;
        
        const volumePricingTiers = (variant.metadata?.volume_pricing_tiers || []) as any[];
        if (volumePricingTiers.length > 0) {
          const firstTier = volumePricingTiers[0] as any;
          if (firstTier.pricePerSqm < cheapestPricePerSqm) {
            cheapestPricePerSqm = firstTier.pricePerSqm;
          }
        }
      }

      const minSqm = 0.09; // 30cm × 30cm = 0.09 m²
      const fromPrice = Math.floor(minSqm * cheapestPricePerSqm);

      // Cache the result
      fromPriceCache.set(productId, {
        price: fromPrice,
        timestamp: Date.now(),
      });

      return res.json({
        from_price: fromPrice,
        cached: false,
        dimensions: { width_cm: 30, height_cm: 30, sqm: 0.09 },
        formula_used: false,
      });
    }

    // Use formula - find cheapest material
    let cheapestPrice = Infinity;
    let cheapestVariantId: string | null = null;
    let cheapestPricePerSqm = 120.0;

    for (const variant of product.variants || []) {
      if (variant.metadata?.custom === true) continue;

      const volumePricingTiers = (variant.metadata?.volume_pricing_tiers || []) as any[];
      if (volumePricingTiers.length > 0) {
        const firstTier = volumePricingTiers[0] as any;
        const pricePerSqm = firstTier.pricePerSqm || 120.0;

        // Calculate price with formula for this material
        const calculatedPrice = await pricingFormulaService.calculatePrice(
          formulaId,
          {
            width_value: 30,
            length_value: 30,
            price_per_sqm: pricePerSqm,
          }
        );

        console.log(`[FROM PRICE] Variant ${variant.id}, price_per_sqm: ${pricePerSqm}, calculated: ${calculatedPrice}`);

        if (calculatedPrice < cheapestPrice) {
          cheapestPrice = calculatedPrice;
          cheapestVariantId = variant.id;
          cheapestPricePerSqm = pricePerSqm;
        }
      }
    }

    console.log(`[FROM PRICE] Cheapest price found: ${cheapestPrice}`);

    const fromPrice = cheapestPrice !== Infinity ? cheapestPrice : Math.floor(0.09 * 120.0);

    // Cache the result
    fromPriceCache.set(productId, {
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
      dimensions: { width_cm: 30, height_cm: 30, sqm: 0.09 },
      formula_used: true,
      cheapest_variant_id: cheapestVariantId,
      cheapest_price_per_sqm: cheapestPricePerSqm,
    });
  } catch (error: any) {
    console.error("Error calculating from price:", error);
    res.status(500).json({
      message: "Failed to calculate from price",
      error: error.message,
    });
  }
};


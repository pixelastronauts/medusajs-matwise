import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";

// In-memory cache for batch price calculations
const priceCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Handle CORS preflight
export const OPTIONS = async (req: MedusaRequest, res: MedusaResponse) => {
  res.status(200).end();
};

// GET /store/products/:id/calculate-prices-batch
// Calculate prices for multiple variants at once (for material comparisons)
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const productId = req.params.id;
  const query = req.query as {
    width_cm?: string;
    height_cm?: string;
    quantity?: string;
    variant_ids?: string; // Comma-separated variant IDs
  };

  const width_cm = parseFloat(query.width_cm || "100");
  const height_cm = parseFloat(query.height_cm || "100");
  const quantity = parseInt(query.quantity || "1");
  const variant_ids = query.variant_ids?.split(",") || [];

  // Generate cache key
  const cacheKey = `${productId}:${width_cm}:${height_cm}:${quantity}:${variant_ids.sort().join(",")}`;

  // Check cache first
  const cached = priceCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return res.json({
      ...cached.data,
      cached: true,
    });
  }

  try {
    const productModuleService = req.scope.resolve(Modules.PRODUCT);
    const pricingFormulaService: any = req.scope.resolve("pricingFormulaModuleService");

    // Retrieve product and check for formula
    const product = await productModuleService.retrieveProduct(productId, {
      select: ["id", "metadata"],
      relations: ["variants"],
    });

    const formulaId = product.metadata?.pricing_formula_id as string | undefined;

    if (!formulaId) {
      return res.status(400).json({
        message: "Product does not have a pricing formula attached",
      });
    }

    // Calculate prices for all variants in parallel
    const pricePromises = variant_ids.map(async (variant_id) => {
      // Find variant in product variants
      const variant = (product.variants || []).find((v: any) => v.id === variant_id);

      if (!variant) {
        return {
          variant_id,
          price_per_item: 0,
          price_per_sqm: 120.0,
        };
      }

      const volumePricingTiers = (variant.metadata?.volume_pricing_tiers ||
        []) as Array<{
        minQty: number;
        maxQty: number | null;
        pricePerSqm: number;
      }>;

      // Find the appropriate tier based on quantity
      let tier = volumePricingTiers.find(
        (t) => quantity >= t.minQty && (t.maxQty === null || quantity <= t.maxQty)
      );

      // If no tier found, use the first tier or default
      if (!tier && volumePricingTiers.length > 0) {
        tier = volumePricingTiers[0];
      }

      const pricePerSqm = tier?.pricePerSqm || 120.0;

      // Calculate price using formula
      const calculatedPrice = await pricingFormulaService.calculatePrice(
        formulaId,
        {
          width_value: width_cm,
          length_value: height_cm,
          price_per_sqm: pricePerSqm,
        }
      );

      return {
        variant_id,
        price_per_item: calculatedPrice,
        price_per_sqm: pricePerSqm,
      };
    });

    const prices = await Promise.all(pricePromises);

    const result = {
      product_id: productId,
      prices,
      dimensions: {
        width_cm,
        height_cm,
        sqm: (width_cm * height_cm) / 10000,
      },
      quantity,
    };

    // Cache the result
    priceCache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
    });

    // Clean up old cache entries (simple cleanup)
    if (priceCache.size > 1000) {
      const now = Date.now();
      for (const [key, value] of priceCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
          priceCache.delete(key);
        }
      }
    }

    res.json({ ...result, cached: false });
  } catch (error: any) {
    console.error("Error calculating batch prices:", error);
    res.status(500).json({
      message: "Failed to calculate prices",
      error: error.message,
    });
  }
};


import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { PRICING_FORMULA_MODULE, type PricingFormulaService } from "../../../../modules/pricing-formula";
import { VOLUME_PRICING_MODULE, type VolumePricingService } from "../../../../modules/volume-pricing";

/**
 * POST /admin/volume-pricing/calculate
 * Calculate price for a variant (for admin simulator)
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const productModuleService = req.scope.resolve(Modules.PRODUCT);
  const pricingFormulaService = req.scope.resolve(PRICING_FORMULA_MODULE) as PricingFormulaService;
  const volumePricingService = req.scope.resolve(VOLUME_PRICING_MODULE) as VolumePricingService;

  const {
    variant_id,
    width_cm,
    height_cm,
    quantity = 1,
    customer_id,
    customer_group_ids = [],
  } = req.body as {
    variant_id: string;
    width_cm: number;
    height_cm: number;
    quantity?: number;
    customer_id?: string;
    customer_group_ids?: string[];
  };

  if (!variant_id || !width_cm || !height_cm) {
    return res.status(400).json({
      message: "variant_id, width_cm, and height_cm are required",
    });
  }

  try {
    // Get the variant to find its product
    const variant = await productModuleService.retrieveProductVariant(variant_id, {
      relations: ["product"],
    });

    if (!variant) {
      return res.status(404).json({ message: "Variant not found" });
    }

    const product = await productModuleService.retrieveProduct(variant.product_id, {
      select: ["id", "metadata"],
    });

    // Try to get price from volume pricing module
    let pricePerSqm = 120.0; // Default fallback
    let priceListId: string | null = null;
    let priceListName: string | null = null;

    const volumePriceResult = await volumePricingService.findApplicablePricePerSqm(
      variant_id,
      quantity,
      {
        customerId: customer_id,
        customerGroupIds: customer_group_ids,
        currencyCode: "eur",
      }
    );

    if (volumePriceResult) {
      // Price from volume pricing module (stored in cents, convert to euros)
      pricePerSqm = volumePriceResult.price_per_sqm / 100;
      priceListId = volumePriceResult.price_list_id;
      priceListName = volumePriceResult.price_list_name;
    } else {
      // Fall back to metadata-based volume pricing tiers
      const volumeTiers = (variant.metadata?.volume_pricing_tiers as any[]) || [];

      if (volumeTiers.length > 0) {
        const tier = volumeTiers.find((t: any) => {
          const minQty = t.minQty || 1;
          const maxQty = t.maxQty || null;

          if (maxQty === null) {
            return quantity >= minQty;
          }

          return quantity >= minQty && quantity <= maxQty;
        });

        if (tier && tier.pricePerSqm) {
          pricePerSqm = tier.pricePerSqm;
          priceListName = "Metadata tiers (legacy)";
        }
      }
    }

    // Check if product has a pricing formula
    const formulaId = product?.metadata?.pricing_formula_id as string | undefined;

    let pricePerItem = 0;

    if (formulaId) {
      try {
        const formula = await pricingFormulaService.retrieveFormula(formulaId);

        if (formula && formula.is_active) {
          pricePerItem = await pricingFormulaService.calculatePrice(
            formulaId,
            {
              width_value: width_cm,
              length_value: height_cm,
              price_per_sqm: pricePerSqm,
            },
            1.0
          );
        }
      } catch (error) {
        console.error("Formula calculation error, falling back to sqm pricing:", error);
      }
    }

    // Fallback to sqm-based pricing if no formula or formula failed
    if (pricePerItem === 0) {
      const sqm = (width_cm * height_cm) / 10000;
      pricePerItem = pricePerSqm * sqm;
    }

    // Calculate total price
    const totalPrice = pricePerItem * quantity;

    res.json({
      price_per_item: Math.round(pricePerItem * 100) / 100,
      total_price: Math.round(totalPrice * 100) / 100,
      price_per_sqm: pricePerSqm,
      price_list_id: priceListId,
      price_list_name: priceListName,
      dimensions: {
        width_cm,
        height_cm,
        sqm: (width_cm * height_cm) / 10000,
      },
      quantity,
      customer_group_ids,
    });
  } catch (error: any) {
    console.error("Error calculating price:", error);
    res.status(500).json({
      message: "Failed to calculate price",
      error: error.message,
    });
  }
};




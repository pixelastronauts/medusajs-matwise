import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { PRICING_FORMULA_MODULE, type PricingFormulaService } from "../../../../../modules/pricing-formula";

// POST /store/products/:id/calculate-price - Calculate price for a product (formula or fallback)
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const productModuleService = req.scope.resolve(Modules.PRODUCT);
  const pricingFormulaService = req.scope.resolve(PRICING_FORMULA_MODULE) as PricingFormulaService;
  
  const { id: productId } = req.params;
  const { 
    width_cm, 
    height_cm, 
    quantity = 1,
    variant_id,
    customization_fees = 0
  } = req.body as {
    width_cm: number;
    height_cm: number;
    quantity?: number;
    variant_id: string;
    customization_fees?: number;
  };

  if (!width_cm || !height_cm || !variant_id) {
    return res.status(400).json({
      message: "width_cm, height_cm, and variant_id are required",
    });
  }

  try {
    // Get product to check for formula
    const product = await productModuleService.retrieveProduct(productId, {
      select: ["id", "metadata"],
      relations: ["variants", "variants.metadata"],
    });

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    // Find the specific variant
    const variant = product.variants?.find((v: any) => v.id === variant_id);
    
    if (!variant) {
      return res.status(404).json({
        message: "Variant not found",
      });
    }

    // Get volume pricing tiers from variant metadata
    const volumeTiers = (variant.metadata?.volume_pricing_tiers as any[]) || [];

    // Find the appropriate tier for the given quantity
    let pricePerSqm = 120.0; // Default fallback
    
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
      }
    }

    // Check if product has a pricing formula
    const formulaId = product.metadata?.pricing_formula_id as string | undefined;
    
    let pricePerItem = 0;

    if (formulaId) {
      // Use formula-based pricing
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
            1.0 // Volume pricing is already in pricePerSqm
          );
        }
      } catch (error) {
        console.error("Formula calculation error, falling back to sqm pricing:", error);
      }
    }

    // Fallback to sqm-based pricing if no formula or formula failed
    if (pricePerItem === 0) {
      const sqm = (width_cm * height_cm) / 10000; // Convert cm² to m²
      pricePerItem = pricePerSqm * sqm;
    }

    // Add customization fees
    pricePerItem += customization_fees;

    // Calculate total price
    const totalPrice = pricePerItem * quantity;

    res.json({
      price_per_item: pricePerItem,
      total_price: totalPrice,
      quantity: quantity,
      price_per_sqm: pricePerSqm,
      dimensions: {
        width_cm,
        height_cm,
        sqm: (width_cm * height_cm) / 10000,
      },
    });
  } catch (error: any) {
    console.error("Error calculating price:", error);
    res.status(500).json({
      message: "Failed to calculate price",
      error: error.message,
    });
  }
};


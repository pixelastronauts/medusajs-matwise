import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { PRICING_FORMULA_MODULE, type PricingFormulaService } from "../../../../../modules/pricing-formula";
import { VOLUME_PRICING_MODULE, type VolumePricingService } from "../../../../../modules/volume-pricing";

// POST /store/products/:id/calculate-price - Calculate price for a product (formula or fallback)
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const productModuleService = req.scope.resolve(Modules.PRODUCT);
  const customerModuleService = req.scope.resolve(Modules.CUSTOMER);
  const pricingFormulaService = req.scope.resolve(PRICING_FORMULA_MODULE) as PricingFormulaService;
  const volumePricingService = req.scope.resolve(VOLUME_PRICING_MODULE) as VolumePricingService;
  
  const { id: productId } = req.params;
  const { 
    width_cm, 
    height_cm, 
    quantity = 1,
    variant_id,
    customization_fees = 0,
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
    // Get authenticated customer and their groups (if logged in)
    const customerId = (req as any).auth_context?.actor_id;
    let customerGroupIds: string[] = [];

    if (customerId) {
      try {
        const customerGroups = await customerModuleService.listCustomerGroups({
          customers: customerId,
        });
        customerGroupIds = customerGroups.map((g: any) => g.id);
      } catch {
        // Ignore errors fetching groups - just use empty array
      }
    }

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

    // Try to get price from new volume pricing module first
    let pricePerSqm = 120.0; // Default fallback
    let priceListId: string | null = null;
    let priceListName: string | null = null;
    let volumePricingTiers: any[] = [];
    
    // Get all tiers for this variant (for display in UI)
    const tiersResult = await volumePricingService.getTiersForVariant(
      variant_id,
      {
        customerId: customerId,
        customerGroupIds: customerGroupIds,
        currencyCode: "eur",
      }
    );

    const isLoggedIn = !!customerId;
    const formulaId = product.metadata?.pricing_formula_id as string | undefined;
    
    // Helper function to calculate price for a given pricePerSqm
    const calculatePriceForTier = async (tierPricePerSqm: number): Promise<number> => {
      if (formulaId) {
        try {
          const formula = await pricingFormulaService.retrieveFormula(formulaId);
          if (formula && formula.is_active) {
            return await pricingFormulaService.calculatePrice(
              formulaId,
              {
                width_value: width_cm,
                length_value: height_cm,
                price_per_sqm: tierPricePerSqm,
              },
              1.0
            );
          }
        } catch (error) {
          console.error("Formula calculation error:", error);
        }
      }
      // Fallback to simple sqm calculation
      const sqm = (width_cm * height_cm) / 10000;
      return tierPricePerSqm * sqm;
    };

    if (tiersResult.tiers.length > 0) {
      priceListId = tiersResult.price_list_id;
      priceListName = tiersResult.price_list_name;
      
      // Convert tiers to frontend format - calculate actual price per item, don't expose sqm price
      volumePricingTiers = await Promise.all(
        tiersResult.tiers.map(async (tier: any) => {
          const requiresLogin = tier.requires_login === true;
          const isHidden = requiresLogin && !isLoggedIn;
          const tierPricePerSqm = tier.price_per_sqm / 100; // Convert cents to euros
          
          // Base tier info - always include quantities
          const tierData: any = {
            minQty: tier.min_quantity,
            maxQty: tier.max_quantity,
            hidden: isHidden,
          };
          
          // Calculate and include actual price per item (not sqm price) if not hidden
          if (!isHidden) {
            tierData.price = await calculatePriceForTier(tierPricePerSqm);
          }
          
          return tierData;
        })
      );

      // Find the applicable tier for the current quantity (only from visible tiers)
      const applicableTier = tiersResult.tiers.find((t: any) => {
        const requiresLogin = t.requires_login === true;
        if (requiresLogin && !isLoggedIn) return false;
        if (t.max_quantity === null) {
          return quantity >= t.min_quantity;
        }
        return quantity >= t.min_quantity && quantity <= t.max_quantity;
      });

      if (applicableTier) {
        pricePerSqm = applicableTier.price_per_sqm / 100;
      }
    } else {
      // Fall back to metadata-based volume pricing tiers
      const volumeTiers = (variant.metadata?.volume_pricing_tiers as any[]) || [];
      
      if (volumeTiers.length > 0) {
        // Calculate prices for metadata tiers too
        volumePricingTiers = await Promise.all(
          volumeTiers.map(async (tier: any) => ({
            minQty: tier.minQty,
            maxQty: tier.maxQty,
            hidden: false,
            price: await calculatePriceForTier(tier.pricePerSqm),
          }))
        );
        
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
    }

    let pricePerItem = 0;

    // Calculate price for current quantity using the applicable tier's pricePerSqm
    pricePerItem = await calculatePriceForTier(pricePerSqm);

    // Add customization fees
    pricePerItem += customization_fees;

    // Calculate total price
    const totalPrice = pricePerItem * quantity;

    // Return minimal data to frontend - don't expose sensitive pricing details
    res.json({
      price_per_item: pricePerItem,
      total_price: totalPrice,
      quantity: quantity,
      volume_pricing_tiers: volumePricingTiers,
      is_logged_in: isLoggedIn,
      dimensions: {
        width_cm,
        height_cm,
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



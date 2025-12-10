import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { createProductVariantsWorkflow } from "@medusajs/medusa/core-flows"
import { PRICING_FORMULA_MODULE, type PricingFormulaService } from "../../../../../modules/pricing-formula"
import { VOLUME_PRICING_MODULE, type VolumePricingService } from "../../../../../modules/volume-pricing"

// POST /store/products/:id/variants
// Create a custom variant for a product (e.g. for custom doormats)
export const POST = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const productModuleService = req.scope.resolve(Modules.PRODUCT)
  
  const productId = req.params.id
  const {
    title,
    sku,
    options = {},
    prices,
    metadata = {},
    manage_inventory = false,
  } = req.body as {
    title: string;
    sku?: string;
    options?: Record<string, any>;
    prices: any[];
    metadata?: Record<string, any>;
    manage_inventory?: boolean;
  }

  try {
    // Verify product exists
    const product = await productModuleService.retrieveProduct(productId, {
      relations: ["variants", "options", "options.values"],
      select: ["id", "metadata"]
    })
    
    // Check if we need to fetch specific base variant metadata for pricing
    let baseVariant = null;
    if (metadata.base_variant_id) {
        const variants = await productModuleService.listProductVariants({
            id: metadata.base_variant_id
        }, {
            select: ["id", "metadata"]
        });
        if (variants.length > 0) {
            baseVariant = variants[0];
        }
    }
    
    // Resolve pricing formula service for formula-based calculations
    const pricingFormulaService = req.scope.resolve(PRICING_FORMULA_MODULE) as PricingFormulaService;
    const volumePricingService = req.scope.resolve(VOLUME_PRICING_MODULE) as VolumePricingService;
    const formulaId = product.metadata?.pricing_formula_id as string | undefined;

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      })
    }

    // Log the options received and product options found
    console.log('🔍 Body options:', JSON.stringify(options, null, 2));
    console.log('🔍 Product options:', JSON.stringify(product.options?.map((o: any) => ({ id: o.id, title: o.title, values: o.values?.map((v: any) => v.value) })), null, 2));

    // Add option values if they don't exist
    if (options && Object.keys(options).length > 0) {
      for (const [optionTitle, optionValue] of Object.entries(options)) {
        // Case-insensitive match for option title
        const productOption = product.options?.find((opt: any) => opt.title.toLowerCase() === optionTitle.toLowerCase())
        
        if (productOption) {
          // Check if this value already exists
          const existingValue = productOption.values?.find((v: any) => v.value === optionValue)
          
          if (!existingValue) {
            console.log(`📝 Adding new option value '${optionValue}' to option '${productOption.title}' (ID: ${productOption.id})`)
            // Add the new option value to the product
            const existingValues = (productOption.values || []).map((v: any) => v.value)
            await productModuleService.upsertProductOptions({
              id: productOption.id,
              values: [...existingValues, String(optionValue)]
            })
            console.log(`✅ Option value added`)
          } else {
            console.log(`ℹ️ Option value '${optionValue}' already exists for '${productOption.title}'`)
          }
        } else {
            console.log(`⚠️ Product option '${optionTitle}' not found on product ${productId}. Creating it...`)
            try {
              await productModuleService.createProductOptions({
                title: optionTitle,
                product_id: productId,
                values: [String(optionValue)]
              })
              console.log(`✅ Created new product option '${optionTitle}' with value '${optionValue}'`)
            } catch (err: any) {
              console.error(`❌ Failed to create option '${optionTitle}':`, err.message)
            }
        }
      }
    }

    // Log the price data being received
    console.log('🔍 Backend received price data:', JSON.stringify(prices, null, 2))
    
    // --- Secure Pricing Calculation ---
    let calculatedPrices = prices;
    if (baseVariant && metadata.width_cm && metadata.height_cm) {
      try {
        console.log(`🔄 Recalculating prices based on base variant ${baseVariant.id}...`);
        
        // 1. Determine customization fees
        let customizationFee = 0;
        if (metadata.print_type === "designhulp") {
           customizationFee += 150.0;
        }
        
        // 2. Calculate square meters
        const width = Number(metadata.width_cm);
        const height = Number(metadata.height_cm);
        const sqm = (width * height) / 10000;
        
        console.log(`📏 Dimensions: ${width}x${height}cm (${sqm.toFixed(4)} m²) | Fee: €${customizationFee}`);

        // 3. Recalculate each price tier using the pricing formula
        // First try new volume pricing module, then fall back to metadata
        const volumePricingResult = await volumePricingService.getTiersForVariant(baseVariant.id);
        const newModuleTiers = volumePricingResult.tiers;
        const metadataTiers = baseVariant.metadata?.volume_pricing_tiers as any[] | undefined;
        
        const hasNewModuleTiers = newModuleTiers && newModuleTiers.length > 0;
        const hasMetadataTiers = metadataTiers && metadataTiers.length > 0;
        
        console.log(`📦 Volume pricing: Module tiers=${hasNewModuleTiers ? newModuleTiers.length : 0}, Metadata tiers=${hasMetadataTiers ? metadataTiers!.length : 0}, Price list: ${volumePricingResult.price_list_name || 'none'}`);
        
        if (hasNewModuleTiers || hasMetadataTiers) {
            calculatedPrices = await Promise.all(prices.map(async (price: any) => {
                let pricePerSqm: number | null = null;
                
                // Try new module first
                if (hasNewModuleTiers) {
                    const matchingTier = newModuleTiers.find((t: any) => 
                        t.min_quantity === price.min_quantity && 
                        (t.max_quantity === price.max_quantity || (t.max_quantity === null && (!price.max_quantity || price.max_quantity === null)))
                    );
                    if (matchingTier) {
                        pricePerSqm = Number(matchingTier.price_per_sqm) / 100; // Convert from cents
                    }
                }
                
                // Fall back to metadata if not found in new module
                if (pricePerSqm === null && hasMetadataTiers) {
                    const matchingTier = metadataTiers!.find((t: any) => 
                        t.minQty === price.min_quantity && 
                        (t.maxQty === price.max_quantity || (t.maxQty === null && (!price.max_quantity || price.max_quantity === null)))
                    );
                    if (matchingTier) {
                        pricePerSqm = matchingTier.pricePerSqm;
                    }
                }
                
                if (pricePerSqm !== null) {
                    let calculatedAmount = 0;
                    
                    // Use pricing formula if available
                    if (formulaId) {
                        try {
                            // Calculate using the pricing formula service (includes shipping, markup, profit)
                            const formulaPrice = await pricingFormulaService.calculatePrice(
                                formulaId,
                                {
                                    width_value: width,
                                    length_value: height,
                                    price_per_sqm: pricePerSqm,
                                },
                                1.0 // Volume pricing is already in the tier
                            );
                            
                            // Add customization fees on top
                            calculatedAmount = formulaPrice + customizationFee;
                            
                            console.log(`💰 Formula calculation for qty ${price.min_quantity}-${price.max_quantity}: Base=€${formulaPrice}, +Fee=€${customizationFee}, Total=€${calculatedAmount}`);
                        } catch (error) {
                            console.error("Formula calculation failed, falling back to simple calculation:", error);
                            // Fallback to simple calculation if formula fails
                            calculatedAmount = pricePerSqm * sqm + customizationFee;
                        }
                    } else {
                        // Fallback to simple calculation if no formula
                        calculatedAmount = pricePerSqm * sqm + customizationFee;
                        console.log(`💰 Simple calculation for qty ${price.min_quantity}-${price.max_quantity}: €${pricePerSqm}/m² × ${sqm.toFixed(4)}m² + €${customizationFee} = €${calculatedAmount}`);
                    }
                    
                    // Round to 2 decimals
                    calculatedAmount = Math.round(calculatedAmount * 100) / 100;
                    
                    if (Math.abs(calculatedAmount - price.amount) > 0.01) {
                        console.log(`⚠️ Price mismatch for qty ${price.min_quantity}-${price.max_quantity}: Frontend=€${price.amount}, Backend=€${calculatedAmount}. Using Backend.`);
                    }
                    
                    return {
                        ...price,
                        amount: calculatedAmount
                    };
                }
                return price;
            }));
        } else {
            console.log("⚠️ Base variant has no volume_pricing_tiers, skipping recalculation.");
        }
      } catch (e) {
        console.error("⚠️ Failed to calculate secure price:", e);
      }
    }

    // Helper: Inject "Default option" if present on product but missing in payload
    // This prevents validation errors when we add a new option (like Material) to a product that has a Default Option
    const defaultOption = product.options?.find((o: any) => o.title === "Default option")
    if (defaultOption && !options["Default option"]) {
      const defaultVal = defaultOption.values?.[0]?.value
      if (defaultVal) {
        console.log(`ℹ️ Injecting 'Default option' value: ${defaultVal} to satisfy product requirements`)
        options["Default option"] = defaultVal
      }
    }

    // Format prices with additional required fields
    const formattedPrices = calculatedPrices.map((price: any) => ({
      ...price,
      rules: price.rules || {},
    }))
    
    console.log('📦 Formatted prices:', JSON.stringify(formattedPrices, null, 2))
    
    // Use workflow to create variant with prices properly linked
    const { result } = await createProductVariantsWorkflow(req.scope).run({
      input: {
        product_variants: [
          {
            product_id: productId,
            title,
            sku: sku || `MW_CUSTOM-${Date.now()}`,
            options,
            prices: formattedPrices,
            metadata: {
              ...metadata,
              custom: true,
              created_via_api: true,
            },
            manage_inventory,
          },
        ],
      },
    })
    
    console.log('✅ Variant created:', result[0]?.id)
    console.log('💰 Created variant data:', JSON.stringify(result[0], null, 2))

    const createdVariant = result[0]

    res.json({
      variant: createdVariant,
    })
  } catch (error: any) {
    console.error("Error creating custom variant:", error)
    res.status(500).json({
      message: "Failed to create custom variant",
      error: error.message,
    })
  }
}



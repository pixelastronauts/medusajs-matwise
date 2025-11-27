import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { updateProductVariantsWorkflow } from "@medusajs/medusa/core-flows"
import { PRICING_FORMULA_MODULE, type PricingFormulaService } from "../../../../../../modules/pricing-formula"

// GET /store/products/:id/variants/:variantId
// Retrieve a custom variant
export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const productModuleService = req.scope.resolve(Modules.PRODUCT)
  const variantId = req.params.variantId

  try {
    // Retrieve variant with all needed relations
    const variants = await productModuleService.listProductVariants({
      id: variantId
    }, {
      relations: ["options", "options.option"],
    })

    if (!variants.length) {
      return res.status(404).json({
        message: "Variant not found",
      })
    }

    res.json({
      variant: variants[0],
    })
  } catch (error: any) {
    console.error("Error retrieving variant:", error)
    res.status(500).json({
      message: "Failed to retrieve variant",
      error: error.message,
    })
  }
}

// PUT /store/products/:id/variants/:variantId
// Update a custom variant
export const PUT = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const productModuleService = req.scope.resolve(Modules.PRODUCT)
  const productId = req.params.id
  const variantId = req.params.variantId

  const {
    title,
    options = {},
    prices,
    metadata = {},
  } = req.body as {
    title?: string;
    options?: Record<string, any>;
    prices?: any[];
    metadata?: Record<string, any>;
  }

  try {
    // Verify product exists
    const product = await productModuleService.retrieveProduct(productId, {
      relations: ["variants", "options", "options.values"],
      select: ["id", "metadata"]
    })

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      })
    }

    // Get the variant to update
    const existingVariants = await productModuleService.listProductVariants({
      id: variantId
    }, {
      select: ["id", "metadata"]
    })

    if (!existingVariants.length) {
        return res.status(404).json({
            message: "Variant not found"
        })
    }

    // Check if we need to fetch specific base variant metadata for pricing
    let baseVariant = null;
    const baseVariantId = metadata?.base_variant_id || existingVariants[0].metadata?.base_variant_id;
    
    if (baseVariantId) {
        const variants = await productModuleService.listProductVariants({
            id: baseVariantId
        }, {
            select: ["id", "metadata"]
        });
        if (variants.length > 0) {
            baseVariant = variants[0];
        }
    }

    // Resolve pricing formula service
    const pricingFormulaService = req.scope.resolve(PRICING_FORMULA_MODULE) as PricingFormulaService;
    const formulaId = product.metadata?.pricing_formula_id as string | undefined;

    console.log('🔄 Updating variant:', variantId);
    console.log('🔍 Body options:', JSON.stringify(options, null, 2));

    // Handle options - ensure they exist and values exist
    const optionValueIds: { id: string }[] = [];

    if (options && Object.keys(options).length > 0) {
        for (const [optionTitle, optionValue] of Object.entries(options)) {
            const productOption = product.options?.find((opt: any) => opt.title.toLowerCase() === optionTitle.toLowerCase())
            
            if (productOption) {
                let existingValue = productOption.values?.find((v: any) => v.value === optionValue)
                
                if (!existingValue) {
                    console.log(`📝 Adding new option value '${optionValue}' to option '${productOption.title}'`)
                    // Add value using upsertProductOptions
                    // We need to be careful to not overwrite other values, but upsert with values array usually appends/merges? 
                    // Actually upsertProductOptions replaces values if passed? 
                    // Medusa Service `upsertProductOptions` might be tricky.
                    // Better to use `createProductOptionValues` if possible, but that might not exist on service.
                    // `addOptionValue`?
                    
                    // Safe way: re-fetch option to be sure, add to list, upsert.
                    // Or better: Use `updateProductOptions` which might have different behavior?
                    // Actually, let's just try to create the option value if we can find a method, 
                    // otherwise we rely on the upsert pattern we used before but we need to fetch the ID.
                    
                    const existingValues = (productOption.values || []).map((v: any) => v.value)
                    await productModuleService.upsertProductOptions({
                        id: productOption.id,
                        values: [...existingValues, String(optionValue)]
                    })
                    
                    // Refetch to get ID
                    const updatedOption = await productModuleService.retrieveProductOption(productOption.id, { relations: ["values"] })
                    existingValue = updatedOption.values?.find((v: any) => v.value === optionValue)
                }
                
                if (existingValue) {
                    optionValueIds.push({ id: existingValue.id })
                }
            } else {
                 // If option doesn't exist, we create it
                 console.log(`⚠️ Product option '${optionTitle}' not found on product ${productId}. Creating it...`)
                 const newOption = await productModuleService.createProductOptions({
                    title: optionTitle,
                    product_id: productId,
                    values: [String(optionValue)]
                 })
                 // newOption is the option. We need the value ID.
                 // createProductOptions returns the option with values?
                 const val = newOption.values?.[0]
                 if (val) {
                     optionValueIds.push({ id: val.id })
                 } else {
                     // Fallback if values not returned populated
                     const updatedOption = await productModuleService.retrieveProductOption(newOption.id, { relations: ["values"] })
                     const v = updatedOption.values?.find((v: any) => v.value === optionValue)
                     if (v) optionValueIds.push({ id: v.id })
                 }
            }
        }
    }

    // Recalculate prices if provided
    let calculatedPrices = prices;
    if (prices && baseVariant && (metadata?.width_cm || existingVariants[0].metadata?.width_cm) && (metadata?.height_cm || existingVariants[0].metadata?.height_cm)) {
        try {
            console.log(`🔄 Recalculating prices based on base variant ${baseVariant.id}...`);
            
            const width = Number(metadata?.width_cm || existingVariants[0].metadata?.width_cm);
            const height = Number(metadata?.height_cm || existingVariants[0].metadata?.height_cm);
            const printType = metadata?.print_type || existingVariants[0].metadata?.print_type;
            
            let customizationFee = 0;
            if (printType === "designhulp") {
               customizationFee += 150.0;
            }
            
            const sqm = (width * height) / 10000;
            
            if (baseVariant.metadata?.volume_pricing_tiers) {
                const tiers = baseVariant.metadata.volume_pricing_tiers as any[];
                
                calculatedPrices = await Promise.all(prices.map(async (price: any) => {
                    const tier = tiers.find((t: any) => 
                        t.minQty === price.min_quantity && 
                        (t.maxQty === price.max_quantity || (t.maxQty === null && (!price.max_quantity || price.max_quantity === null)))
                    );
                    
                    if (tier) {
                        let calculatedAmount = 0;
                        if (formulaId) {
                            try {
                                const formulaPrice = await pricingFormulaService.calculatePrice(
                                    formulaId,
                                    {
                                        width_value: width,
                                        length_value: height,
                                        price_per_sqm: tier.pricePerSqm,
                                    },
                                    1.0
                                );
                                calculatedAmount = formulaPrice + customizationFee;
                            } catch (error) {
                                calculatedAmount = tier.pricePerSqm * sqm + customizationFee;
                            }
                        } else {
                            calculatedAmount = tier.pricePerSqm * sqm + customizationFee;
                        }
                        
                        calculatedAmount = Math.round(calculatedAmount * 100) / 100;
                        return { ...price, amount: calculatedAmount };
                    }
                    return price;
                }));
            }
        } catch (e) {
            console.error("⚠️ Failed to calculate secure price during update:", e);
        }
    }

    // Use workflow to update variant
    // Note: updateProductVariantsWorkflow expects { product_variants: [...] } but checking signature
    // If not using workflow, we can use productModuleService.upsertProductVariants?
    // But workflow handles prices properly.
    // Let's try updating via upsert if workflow is not easily available for single update or check docs.
    // Actually `updateProductVariantsWorkflow` exists in core-flows.

    const formattedPrices = calculatedPrices ? calculatedPrices.map((price: any) => ({
      ...price,
      rules: price.rules || {},
    })) : undefined

    const updateData: any = {
        id: variantId,
        product_id: productId,
    };
    if (title) updateData.title = title;
    
    // Use resolved option value IDs if available, otherwise fall back to original options (though likely to fail if object)
    if (optionValueIds.length > 0) {
        updateData.options = optionValueIds;
    } else if (options && Object.keys(options).length > 0) {
        // If we have options but couldn't resolve IDs (shouldn't happen), 
        // we might choose to skip updating options or try passing as is (which we know fails).
        // Let's log warning.
        console.warn("⚠️ Could not resolve option value IDs, skipping options update to avoid error.");
    }
    
    if (formattedPrices) updateData.prices = formattedPrices;
    if (metadata) {
        updateData.metadata = {
            ...existingVariants[0].metadata,
            ...metadata
        };
    }

    const { result } = await updateProductVariantsWorkflow(req.scope).run({
      input: {
        product_variants: [updateData],
      },
    })

    console.log('✅ Variant updated:', result[0]?.id)

    res.json({
      variant: result[0],
    })

  } catch (error: any) {
    console.error("Error updating custom variant:", error)
    res.status(500).json({
      message: "Failed to update custom variant",
      error: error.message,
    })
  }
}



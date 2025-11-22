import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { createProductVariantsWorkflow } from "@medusajs/medusa/core-flows"

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
      relations: ["variants", "options"],
    })

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      })
    }

    // Add option values if they don't exist
    if (options && Object.keys(options).length > 0) {
      for (const [optionTitle, optionValue] of Object.entries(options)) {
        const productOption = product.options?.find((opt: any) => opt.title === optionTitle)
        
        if (productOption) {
          // Check if this value already exists
          const existingValue = productOption.values?.find((v: any) => v.value === optionValue)
          
          if (!existingValue) {
            // Add the new option value to the product
            const existingValues = (productOption.values || []).map((v: any) => v.value)
            await productModuleService.upsertProductOptions({
              id: productOption.id,
              values: [...existingValues, String(optionValue)]
            })
          }
        }
      }
    }

    // Log the price data being received
    console.log('🔍 Backend received price data:', JSON.stringify(prices, null, 2))
    
    // Format prices with additional required fields
    const formattedPrices = prices.map((price: any) => ({
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
            sku: sku || `CUSTOM-${Date.now()}`,
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



import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

type SortEntry = {
  variant_id: string
  sort_order: number
}

type RequestBody = {
  sorted_variants: SortEntry[]
  default_variant_id?: string | null
}

/**
 * POST /admin/products/:id/variants/sort
 * Update variant sort order and optionally set a default variant
 */
export const POST = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const productModuleService = req.scope.resolve(Modules.PRODUCT)
  const productId = req.params.id
  const { sorted_variants, default_variant_id } = req.body as RequestBody

  if (!sorted_variants || !Array.isArray(sorted_variants)) {
    return res.status(400).json({
      message: "sorted_variants array is required",
    })
  }

  try {
    // First, get all base variants for this product to clear any existing default
    const allVariants = await productModuleService.listProductVariants(
      { product_id: productId },
      { select: ['id', 'metadata'] }
    )

    // Filter to only non-custom variants (base variants)
    const baseVariantIds = allVariants
      .filter((v: any) => {
        const isCustomOrder = v.metadata?.is_custom_order === true
        const isCustom = v.metadata?.custom === true
        const hasBaseVariantId = !!v.metadata?.base_variant_id
        return !isCustomOrder && !isCustom && !hasBaseVariantId
      })
      .map((v: any) => v.id)

    // Update all variants in the sorted list
    const updatePromises = sorted_variants.map(async (entry) => {
      const existingVariant = allVariants.find((v: any) => v.id === entry.variant_id)
      if (!existingVariant) return null

      const isDefault = default_variant_id === entry.variant_id

      // Only update sort_order and is_default_variant, preserve other metadata
      const updatedMetadata = {
        ...existingVariant.metadata,
        sort_order: entry.sort_order,
        is_default_variant: isDefault,
      }

      await productModuleService.updateProductVariants(entry.variant_id, {
        metadata: updatedMetadata,
      })

      return { id: entry.variant_id, sort_order: entry.sort_order, is_default: isDefault }
    })

    // Also clear is_default_variant from any variants not in the sorted list
    const sortedIds = sorted_variants.map(s => s.variant_id)
    const variantsToUnset = allVariants.filter((v: any) => 
      !sortedIds.includes(v.id) && v.metadata?.is_default_variant === true
    )
    
    const clearDefaultPromises = variantsToUnset.map(async (variant: any) => {
      const { is_default_variant, ...restMetadata } = variant.metadata || {}
      await productModuleService.updateProductVariants(variant.id, {
        metadata: restMetadata,
      })
    })

    await Promise.all([...updatePromises, ...clearDefaultPromises])

    console.log(`✅ Updated variant sort order for product ${productId}`)
    if (default_variant_id) {
      console.log(`✅ Set default variant: ${default_variant_id}`)
    }

    res.json({
      success: true,
      product_id: productId,
      default_variant_id: default_variant_id || null,
      updated_count: sorted_variants.length,
    })
  } catch (error: any) {
    console.error("Error updating variant sort order:", error)
    res.status(500).json({
      message: "Failed to update variant sort order",
      error: error.message,
    })
  }
}


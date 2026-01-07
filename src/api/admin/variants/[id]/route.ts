import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

/**
 * PATCH /admin/variants/:id
 * Update variant metadata (used by Dashboard to attach design_id)
 */
export const PATCH = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  const productModuleService = req.scope.resolve(Modules.PRODUCT)
  const variantId = req.params.id
  const { metadata } = req.body as { metadata?: Record<string, any> }

  if (!metadata) {
    return res.status(400).json({
      message: "metadata is required",
    })
  }

  try {
    // Get existing variant
    const variants = await productModuleService.listProductVariants(
      { id: variantId },
      { select: ['id', 'metadata'] }
    )

    if (!variants || variants.length === 0) {
      return res.status(404).json({
        message: "Variant not found",
      })
    }

    const existingVariant = variants[0]

    // Merge existing metadata with new metadata
    const updatedMetadata = {
      ...existingVariant.metadata,
      ...metadata,
    }

    // Update variant
    await productModuleService.updateProductVariants(variantId, {
      metadata: updatedMetadata,
    })

    // Fetch updated variant
    const updatedVariants = await productModuleService.listProductVariants(
      { id: variantId },
      { select: ['id', 'metadata'] }
    )

    console.log(`✅ Variant ${variantId} metadata updated with design_id: ${metadata.design_id}`)

    res.json({
      variant: updatedVariants[0],
    })
  } catch (error: any) {
    console.error("Error updating variant metadata:", error)
    res.status(500).json({
      message: "Failed to update variant metadata",
      error: error.message,
    })
  }
}




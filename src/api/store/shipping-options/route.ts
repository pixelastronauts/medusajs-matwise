import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { listShippingOptionsForCartWithPricingWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Custom shipping options endpoint that implements tiered shipping logic:
 * 
 * - Cart with ONLY mercury shipping profile products → Free DPD shipping only
 * - Cart with sample products (regardless of other products) → PostNL only
 * - Cart with mercury + sample products → PostNL only (samples take priority)
 * - Cart with default products only → Default PostNL shipping
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const cartId = req.query.cart_id as string

  if (!cartId) {
    return res.status(400).json({
      message: "cart_id is required"
    })
  }

  try {
    // Step 1: Get cart with items and their product shipping profiles
    const { data: carts } = await query.graph({
      entity: "cart",
      fields: [
        "id",
        "items.id",
        "items.product_id",
        "items.variant_id",
        "items.product.id",
        "items.product.shipping_profile.id",
        "items.product.shipping_profile.type",
        "items.product.shipping_profile.name",
      ],
      filters: { id: cartId },
    })

    const cart = carts[0]
    if (!cart) {
      return res.status(404).json({
        message: "Cart not found"
      })
    }

    // Step 2: Analyze shipping profiles in the cart
    const shippingProfiles = new Set<string>()
    const profileDetails: Record<string, { id: string; name: string }> = {}

    for (const item of cart.items || []) {
      const profile = item.product?.shipping_profile
      if (profile?.type) {
        shippingProfiles.add(profile.type)
        profileDetails[profile.type] = {
          id: profile.id,
          name: profile.name
        }
      }
    }

    console.log(`[Shipping Options] Cart ${cartId} has profiles:`, Array.from(shippingProfiles))

    // Step 3: Run the workflow with pricing to get all available shipping options
    const { result } = await listShippingOptionsForCartWithPricingWorkflow(req.scope).run({
      input: {
        cart_id: cartId,
        is_return: req.query.is_return === "true",
      },
    })

    // Step 4: Apply tiered shipping logic to filter options
    let filteredOptions = result

    const hasSampleProducts = shippingProfiles.has("sample")
    const hasMercuryProducts = shippingProfiles.has("mercury")
    const hasDefaultProducts = shippingProfiles.has("default")
    const hasOnlyMercury = hasMercuryProducts && !hasSampleProducts && !hasDefaultProducts

    console.log(`[Shipping Options] Analysis:`, {
      hasSampleProducts,
      hasMercuryProducts,
      hasDefaultProducts,
      hasOnlyMercury,
      profileDetails,
    })

    if (hasSampleProducts) {
      // Sample products present → Show only PostNL for samples
      // This takes priority over everything else (mercury + sample = samples shipping)
      const sampleProfileId = profileDetails["sample"]?.id

      filteredOptions = result.filter((option: any) => {
        // Match by the sample shipping profile ID
        return option.shipping_profile_id === sampleProfileId
      })
      console.log(`[Shipping Options] Samples present - filtered to sample profile (${sampleProfileId}):`, filteredOptions.length)
    } else if (hasOnlyMercury) {
      // Mercury products ONLY (no samples, no default) → Show only DPD (mercury shipping option)
      const mercuryProfileId = profileDetails["mercury"]?.id

      filteredOptions = result.filter((option: any) => {
        // Match by the mercury shipping profile ID
        return option.shipping_profile_id === mercuryProfileId
      })
      console.log(`[Shipping Options] Mercury only - filtered to mercury profile (${mercuryProfileId}):`, filteredOptions.length)
    } else if (hasDefaultProducts && !hasMercuryProducts) {
      // Default products only → Show default PostNL
      const defaultProfileId = profileDetails["default"]?.id

      filteredOptions = result.filter((option: any) => {
        return option.shipping_profile_id === defaultProfileId
      })
      console.log(`[Shipping Options] Default only - filtered to default profile (${defaultProfileId}):`, filteredOptions.length)
    }
    // For mixed default+mercury without samples, we show options for both profiles

    // If filtering resulted in no options, fall back to all options
    if (filteredOptions.length === 0) {
      console.log(`[Shipping Options] Filtering resulted in 0 options, falling back to all`)
      filteredOptions = result
    }

    return res.json({
      shipping_options: filteredOptions,
    })
  } catch (error: any) {
    console.error("[Shipping Options] Error:", error)
    return res.status(500).json({
      message: "Failed to fetch shipping options",
      error: error.message
    })
  }
}

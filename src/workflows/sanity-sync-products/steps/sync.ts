import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ProductDTO } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, promiseAll } from "@medusajs/framework/utils"
import SanityModuleService from "../../../modules/sanity/service"
import { SANITY_MODULE } from "../../../modules/sanity"

export type SyncStepInput = {
  product_ids?: string[]
}

export const syncStep = createStep(
  { name: "sync-products-step", async: true },
  async (input: SyncStepInput, { container }) => {
    const sanityModule: SanityModuleService = container.resolve(SANITY_MODULE)
    const query = container.resolve(ContainerRegistrationKeys.QUERY)

    let total = 0
    const upsertMap: {
      before: any
      after: any
    }[] = []

    const batchSize = 200
    let hasMore = true
    let offset = 0

    const filters = input.product_ids
      ? {
          id: input.product_ids,
        }
      : {}

    while (hasMore) {
      const {
        data: products,
        metadata: { count } = {},
      } = await query.graph({
        entity: "product",
        fields: [
          "id",
          "title",
          "handle",
          "sanity_product.*",
          "variants.id",
          "variants.title",
          "variants.sku",
        ],
        filters,
        pagination: {
          skip: offset,
          take: batchSize,
          order: {
            id: "ASC",
          },
        },
      })

      try {
        await promiseAll(
          products.map(async (prod) => {
            // Check if product should be excluded (handle contains 'mw_')
            const handle = prod.handle?.toLowerCase() || ''
            const shouldExcludeProduct = handle.includes('mw_')
            
            if (shouldExcludeProduct) {
              // Delete product from Sanity if it exists
              try {
                const existing = await sanityModule.retrieve(prod.id)
                if (existing) {
                  await sanityModule.delete(prod.id)
                }
              } catch (e) {
                // Product doesn't exist in Sanity, ignore
              }
              
              // Also delete all its variants from Sanity
              if (prod.variants) {
                await promiseAll(
                  prod.variants.map(async (variant: any) => {
                    try {
                      const existing = await sanityModule.retrieve(variant.id)
                      if (existing) {
                        await sanityModule.delete(variant.id)
                      }
                    } catch (e) {
                      // Variant doesn't exist in Sanity, ignore
                    }
                  })
                )
              }
              
              return null
            }
            
            // First, sync the product without variants to ensure it exists in Sanity
            const after = await sanityModule.upsertSyncDocument(
              "product",
              { ...prod, variants: [] } as unknown as ProductDTO
            )
            
            // Then sync the variants that reference this product
            const variantRefs: any[] = []
            if (prod.variants) {
              // Split variants into those to sync and those to exclude
              const variantsToSync: any[] = []
              const variantsToExclude: any[] = []
              
              prod.variants.forEach((variant: any) => {
                const sku = variant.sku?.toLowerCase() || ''
                if (sku.includes('mw_')) {
                  variantsToExclude.push(variant)
                } else {
                  variantsToSync.push(variant)
                }
              })
              
              // Delete excluded variants from Sanity if they exist
              await promiseAll(
                variantsToExclude.map(async (variant: any) => {
                  try {
                    const existing = await sanityModule.retrieve(variant.id)
                    if (existing) {
                      await sanityModule.delete(variant.id)
                    }
                  } catch (e) {
                    // Variant doesn't exist in Sanity, ignore
                  }
                })
              )
              
              // Sync the allowed variants
              await promiseAll(
                variantsToSync.map(async (variant: any) => {
                  await sanityModule.upsertSyncDocument("productVariant", {
                    ...variant,
                    product_id: prod.id,
                  })
                  variantRefs.push({
                    _type: "reference",
                    _ref: variant.id,
                    _key: variant.id,
                  })
                })
              )
              
              // Finally, update the product with the variant references
              await sanityModule.upsertSyncDocument(
                "product",
                { ...prod, variants: variantRefs } as unknown as ProductDTO
              )
            }

            if (after) {
              upsertMap.push({
                // @ts-ignore
                before: prod.sanity_product,
                after,
              })
            }
            return after
          })
        )
      } catch (e) {
        return StepResponse.permanentFailure(
          `An error occurred while syncing products: ${e}`,
          upsertMap
        )
      }

      offset += batchSize
      hasMore = offset < count
      total += products.length
    }

    return new StepResponse({ total }, upsertMap)
  },
  async (upsertMap, { container }) => {
    if (!upsertMap) {
      return
    }

    const sanityModule: SanityModuleService = container.resolve(SANITY_MODULE)

    await promiseAll(
      upsertMap.map(({ before, after }) => {
        if (!before) {
          return sanityModule.delete(after._id)
        }
        const { _id: id, ...oldData } = before
        return sanityModule.update(id, oldData)
      })
    )
  }
)


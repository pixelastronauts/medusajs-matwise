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
        fields: ["id", "title", "handle", "sanity_product.*", "variants.*"],
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
            // First, sync the product without variants to ensure it exists in Sanity
            const after = await sanityModule.upsertSyncDocument(
              "product",
              { ...prod, variants: [] } as unknown as ProductDTO
            )
            
            // Then sync the variants that reference this product
            const variantRefs: any[] = []
            if (prod.variants) {
              // Filter out variants with 'custom-' in their title (case insensitive)
              const filteredVariants = prod.variants.filter((variant: any) => {
                const title = variant.title?.toLowerCase() || ''
                return !title.includes('custom-')
              })
              
              await promiseAll(
                filteredVariants.map(async (variant: any) => {
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

            upsertMap.push({
              // @ts-ignore
              before: prod.sanity_product,
              after,
            })
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


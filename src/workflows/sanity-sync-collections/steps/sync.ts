import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, promiseAll } from "@medusajs/framework/utils"
import SanityModuleService from "../../../modules/sanity/service"
import { SANITY_MODULE } from "../../../modules/sanity"

export type SyncCollectionStepInput = {
  collection_ids?: string[]
}

export const syncCollectionStep = createStep(
  { name: "sync-collections-step", async: true },
  async (input: SyncCollectionStepInput, { container }) => {
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

    const filters = input.collection_ids
      ? {
          id: input.collection_ids,
        }
      : {}

    while (hasMore) {
      const {
        data: collections,
        metadata: { count } = {},
      } = await query.graph({
        entity: "product_collection",
        fields: ["id", "title", "handle", "sanity_collection.*"],
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
          collections.map(async (collection) => {
            const after = await sanityModule.upsertSyncDocument("collection", collection)
            upsertMap.push({
              // @ts-ignore
              before: collection.sanity_collection,
              after,
            })
            return after
          })
        )
      } catch (e) {
        return StepResponse.permanentFailure(
          `An error occurred while syncing collections: ${e}`,
          upsertMap
        )
      }

      offset += batchSize
      hasMore = offset < count
      total += collections.length
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



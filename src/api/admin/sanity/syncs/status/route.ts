import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import SanityModuleService from "../../../../../modules/sanity/service"
import { SANITY_MODULE } from "../../../../../modules/sanity"

type SyncStatus = {
  id: string
  title: string
  handle: string
  medusa_updated_at: string
  sanity_synced_at: string | null
  status: "synced" | "out_of_sync" | "missing_in_sanity"
  variants_count: number
  variants_synced: number
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const sanityModule: SanityModuleService = req.scope.resolve(SANITY_MODULE)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  // Get all products from Medusa
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "title", "handle", "updated_at", "variants.id"],
  })

  // Get all product IDs and check them in Sanity
  const productIds = products.map((p: any) => p.id)
  const sanityDocs = await sanityModule.list({ id: productIds })

  // Create a map of Sanity docs by ID
  const sanityMap = new Map(sanityDocs.map((doc: any) => [doc?.id, doc]))

  const statuses: SyncStatus[] = []
  let syncedCount = 0
  let outOfSyncCount = 0
  let missingCount = 0

  for (const product of products) {
    const sanityDoc = sanityMap.get(product.id)
    const variantsCount = product.variants?.length || 0

    if (!sanityDoc) {
      missingCount++
      statuses.push({
        id: product.id,
        title: product.title,
        handle: product.handle,
        medusa_updated_at: product.updated_at,
        sanity_synced_at: null,
        status: "missing_in_sanity",
        variants_count: variantsCount,
        variants_synced: 0,
      })
      continue
    }

    // Check if Sanity was synced after Medusa was updated
    const medusaUpdated = new Date(product.updated_at).getTime()
    const sanitySynced = sanityDoc.lastSyncedAt
      ? new Date(sanityDoc.lastSyncedAt).getTime()
      : 0

    // Consider synced if Sanity was updated within 1 minute of Medusa update
    // (to account for sync delay)
    const isSynced = sanitySynced >= medusaUpdated - 60000

    // Count synced variants
    const variantsSynced = sanityDoc.variants?.length || 0

    if (isSynced && variantsSynced === variantsCount) {
      syncedCount++
      statuses.push({
        id: product.id,
        title: product.title,
        handle: product.handle,
        medusa_updated_at: product.updated_at,
        sanity_synced_at: sanityDoc.lastSyncedAt,
        status: "synced",
        variants_count: variantsCount,
        variants_synced: variantsSynced,
      })
    } else {
      outOfSyncCount++
      statuses.push({
        id: product.id,
        title: product.title,
        handle: product.handle,
        medusa_updated_at: product.updated_at,
        sanity_synced_at: sanityDoc.lastSyncedAt,
        status: "out_of_sync",
        variants_count: variantsCount,
        variants_synced: variantsSynced,
      })
    }
  }

  // Sort: missing first, then out of sync, then synced
  const statusOrder = { missing_in_sanity: 0, out_of_sync: 1, synced: 2 }
  statuses.sort((a, b) => statusOrder[a.status] - statusOrder[b.status])

  res.json({
    summary: {
      total: products.length,
      synced: syncedCount,
      out_of_sync: outOfSyncCount,
      missing_in_sanity: missingCount,
      sync_percentage: products.length
        ? Math.round((syncedCount / products.length) * 100)
        : 100,
    },
    products: statuses,
  })
}



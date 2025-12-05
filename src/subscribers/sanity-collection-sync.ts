import type { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { sanitySyncCollectionsWorkflow } from "../workflows/sanity-sync-collections"

export default async function upsertSanityCollection({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  // Skip automatic sync in development - use manual sync via admin UI instead
  if (process.env.NODE_ENV !== "production") {
    return
  }

  await sanitySyncCollectionsWorkflow(container).run({
    input: {
      collection_ids: [data.id],
    },
  })
}

export const config: SubscriberConfig = {
  event: ["product-collection.created", "product-collection.updated"],
}




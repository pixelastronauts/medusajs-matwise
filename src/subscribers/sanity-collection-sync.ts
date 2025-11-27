import type { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { sanitySyncCollectionsWorkflow } from "../workflows/sanity-sync-collections"

export default async function upsertSanityCollection({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  await sanitySyncCollectionsWorkflow(container).run({
    input: {
      collection_ids: [data.id],
    },
  })
}

export const config: SubscriberConfig = {
  event: ["product-collection.created", "product-collection.updated"],
}



import type { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { sanitySyncProductsWorkflow } from "../workflows/sanity-sync-products"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function upsertSanityProduct({
  event: { name, data },
  container,
}: SubscriberArgs<{ id: string; product_id?: string }>) {
  let productIds: string[] = []

  if (name.includes("variant")) {
    if (data.product_id) {
      productIds = [data.product_id]
    } else {
      try {
        const query = container.resolve(ContainerRegistrationKeys.QUERY)
        const {
          data: [variant],
        } = await query.graph({
          entity: "product_variant",
          fields: ["product_id"],
          filters: { id: data.id },
        })
        if (variant?.product_id) {
          productIds = [variant.product_id]
        }
      } catch (e) {
        // ignore
      }
    }
  } else {
    productIds = [data.id]
  }

  if (productIds.length) {
    await sanitySyncProductsWorkflow(container).run({
      input: {
        product_ids: productIds,
      },
    })
  }
}

export const config: SubscriberConfig = {
  event: [
    "product.created",
    "product.updated",
    "product-variant.created",
    "product-variant.updated",
    "product-variant.deleted",
  ],
}


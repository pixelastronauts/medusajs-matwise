import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"
import { SANITY_MODULE } from "../modules/sanity"

defineLink(
  {
    linkable: ProductModule.linkable.productCollection.id,
    field: "id",
  },
  {
    linkable: {
      serviceName: SANITY_MODULE,
      alias: "sanity_collection",
      primaryKey: "id",
    },
  },
  {
    readOnly: true,
  }
)




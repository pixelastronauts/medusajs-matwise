import { defineMiddlewares, validateAndTransformBody } from "@medusajs/framework/http"
import { PostInvoiceConfigSchema } from "./admin/invoice-config/route"

export default defineMiddlewares({
  routes: [
    {
      matcher: "/admin/invoice-config",
      methods: ["POST"],
      middlewares: [
        validateAndTransformBody(PostInvoiceConfigSchema),
      ],
    },
  ],
})


import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import SanityModuleService from "../../../../../modules/sanity/service"
import { SANITY_MODULE } from "../../../../../modules/sanity"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params

  const sanityModule: SanityModuleService = req.scope.resolve(SANITY_MODULE)

  const sanityDocument = await sanityModule.retrieve(id)

  res.json({ sanity_document: sanityDocument })
}



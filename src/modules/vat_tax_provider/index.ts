import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import VatTaxProviderService from "./service"

export const VAT_TAX_PROVIDER = "vat_tax_provider"

export default ModuleProvider(Modules.TAX, {
  services: [VatTaxProviderService],
})

export * from "./types"


import VatTaxProviderService from "./service"
import { ModuleProvider, Modules } from "@medusajs/framework/utils"

export const VAT_TAX_PROVIDER = "vat-tax-provider"

export default ModuleProvider(Modules.TAX, {
  services: [VatTaxProviderService],
})



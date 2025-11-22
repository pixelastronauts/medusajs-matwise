import VatTaxProviderService from "./service"
import { Module } from "@medusajs/framework/utils"

export const VAT_TAX_PROVIDER = "vat-tax-provider"

export default Module(VAT_TAX_PROVIDER, {
  service: VatTaxProviderService,
})



import { Module } from "@medusajs/framework/utils"
import VatValidationService from "./service"

export const VAT_VALIDATION_MODULE = "vat_validation"

export default Module(VAT_VALIDATION_MODULE, {
  service: VatValidationService,
})

export * from "./service"


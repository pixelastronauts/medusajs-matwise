import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { ICartModuleService } from "@medusajs/framework/types"
import { VAT_VALIDATION_MODULE } from "../../modules/vat_validation"
import type VatValidationService from "../../modules/vat_validation/service"

type CalculateVatTaxInput = {
  cart_id: string
}

type CalculateVatTaxOutput = {
  should_calculate_tax: boolean
  vat_validated: boolean
  reason: string
}

export const calculateVatTaxStep = createStep(
  "calculate-vat-tax",
  async (input: CalculateVatTaxInput, { container }) => {
    const cartModuleService: ICartModuleService = container.resolve(Modules.CART)
    const vatValidationService = container.resolve(VAT_VALIDATION_MODULE) as VatValidationService

    const cart = await cartModuleService.retrieveCart(input.cart_id, {
      relations: ['shipping_address']
    })

    if (!cart.shipping_address?.country_code) {
      return new StepResponse({
        should_calculate_tax: true,
        vat_validated: false,
        reason: 'No shipping address'
      })
    }

    const metadata = cart.metadata || {}
    const isCompanyCheckout = metadata.is_company_checkout === true
    const vatNumber = metadata.vat_number as string | null
    const storeCountry = 'NL'
    
    // If not a company checkout, apply standard tax rules (tax only for NL)
    if (!isCompanyCheckout) {
      const shouldTax = cart.shipping_address.country_code.toUpperCase() === storeCountry.toUpperCase()
      return new StepResponse({
        should_calculate_tax: shouldTax,
        vat_validated: false,
        reason: shouldTax ? 'NL domestic order' : 'International order (no VAT)'
      })
    }

    // Company checkout - check VAT number
    const shouldTax = await vatValidationService.shouldCalculateTax(
      vatNumber,
      cart.shipping_address.country_code,
      storeCountry
    )

    let reason = ''
    if (shouldTax) {
      if (cart.shipping_address.country_code.toUpperCase() === storeCountry.toUpperCase()) {
        reason = 'NL domestic company order'
      } else {
        reason = 'Invalid VAT or VAT/shipping country mismatch'
      }
    } else {
      reason = 'Valid EU VAT - reverse charge applies'
    }

    return new StepResponse({
      should_calculate_tax: shouldTax,
      vat_validated: !!vatNumber,
      reason
    })
  }
)


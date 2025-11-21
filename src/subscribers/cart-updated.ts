import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'
import { ICartModuleService } from '@medusajs/framework/types'
import { VAT_VALIDATION_MODULE } from '../modules/vat_validation'
import type VatValidationService from '../modules/vat_validation/service'

/**
 * Tax-Inclusive Pricing with Reverse Charge
 * 
 * All prices are stored GROSS (including 21% VAT)
 * 
 * For NL orders:
 * - No adjustment needed, customer pays full price
 * - Example: €90.00 (including €16.49 VAT)
 * 
 * For EU B2B with valid VAT (Reverse Charge):
 * - Calculate VAT amount: gross - (gross / 1.21)
 * - Store in metadata to show "BTW verlegd" message
 * - Frontend will apply discount
 * - Example: €90.00 → Customer pays €78.51, sees "BTW verlegd (21%): €16.49"
 */
export default async function cartUpdatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const cartModuleService: ICartModuleService = container.resolve(Modules.CART)
  const vatValidationService = container.resolve(VAT_VALIDATION_MODULE) as VatValidationService
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  try {
    // Retrieve the cart with calculated totals using Query
    let cart: any
    try {
      const { data: carts } = await query.graph({
        entity: 'cart',
        fields: [
          'id',
          'currency_code',
          'total',
          'subtotal',
          'item_subtotal',
          'shipping_total',
          'discount_total',
          'tax_total',
          'metadata',
          'shipping_address.*',
          'items.*',
          'items.adjustments.*',
          'shipping_methods.*',
        ],
        filters: {
          id: data.id,
        },
      })
      cart = carts[0]
    } catch (queryError) {
      console.error('Error using Query, falling back to cart module service:', queryError)
      // Fallback to cart module service if Query fails
      cart = await cartModuleService.retrieveCart(data.id, {
        relations: ['shipping_address', 'items', 'items.adjustments', 'shipping_methods']
      })
    }

    if (!cart || !cart.shipping_address?.country_code) {
      return // No shipping address yet, skip
    }

    const metadata = cart.metadata || {}
    const isCompanyCheckout = metadata.is_company_checkout === true
    const vatNumber = metadata.vat_number as string | null

    // Determine if reverse charge applies
    // Reverse charge ONLY for: Company checkout + Valid VAT + Different EU country
    const shouldCalculateTax = await vatValidationService.shouldCalculateTax(
      vatNumber,
      cart.shipping_address.country_code,
      'NL'
    )

    // Reverse charge only applies when ALL conditions are met:
    // 1. Company checkout
    // 2. Valid VAT number provided
    // 3. Tax should NOT be calculated (EU B2B reverse charge rule)
    const reverseChargeApplies = isCompanyCheckout && !!vatNumber && !shouldCalculateTax

    // Calculate reverse charge amount (VAT to be removed from gross prices)
    let reverseChargeAmount = 0
    let reverseChargePercentage = 0

    if (reverseChargeApplies) {
      // Reverse charge applies - calculate the VAT amount
      // VAT should be calculated on the FINAL cart total (after discounts)
      
      // In Medusa v2, prices are in MAJOR UNITS (euros as decimals)
      // We need to maintain 2 decimal place precision for currency
      const grossTotal = Number(cart.total || 0)
      
      // Calculate net amount (gross / 1.21) since prices are tax-inclusive
      // Round to 2 decimal places for currency precision
      const netTotal = Math.round((grossTotal / 1.21) * 100) / 100
      
      // VAT amount is the difference
      reverseChargeAmount = Math.round((grossTotal - netTotal) * 100) / 100
      reverseChargePercentage = 21 // Always 21% for NL VAT
      
      console.log(`🧮 VAT Calculation:`)
      console.log(`   Cart Total (incl. VAT): €${grossTotal.toFixed(2)}`)
      console.log(`   Net Total (excl. VAT): €${netTotal.toFixed(2)}`)
      console.log(`   VAT Amount (21%): €${reverseChargeAmount.toFixed(2)}`)
    }

    // NOTE: We do NOT use line item adjustments because they interfere with promotions
    // Instead, we store the VAT amount in metadata and adjust the payment amount later
    console.log(`💡 Reverse charge VAT stored in metadata (no adjustments used to avoid promotion conflicts)`)

    // Check if metadata has changed to avoid infinite loop
    const metadataChanged = 
      metadata.reverse_charge_applies !== reverseChargeApplies ||
      metadata.reverse_charge_amount !== reverseChargeAmount ||
      metadata.should_calculate_tax !== shouldCalculateTax
    
    if (metadataChanged) {
      // Update cart metadata with tax information
      await cartModuleService.updateCarts(cart.id, {
        metadata: {
          ...metadata,
          should_calculate_tax: shouldCalculateTax,
          vat_validated: !!vatNumber && isCompanyCheckout,
          reverse_charge_applies: reverseChargeApplies,
          reverse_charge_amount: reverseChargeAmount,
          reverse_charge_percentage: reverseChargePercentage,
        }
      })

      console.log(`Cart ${cart.id}: Company=${isCompanyCheckout}, VAT=${vatNumber || 'none'}, ${reverseChargeApplies ? 'REVERSE CHARGE' : 'NORMAL TAX'}, VAT amount: €${(reverseChargeAmount / 100).toFixed(2)}`)
      console.log(`   Metadata stored:`, {
        reverse_charge_applies: reverseChargeApplies,
        reverse_charge_amount: reverseChargeAmount,
        reverse_charge_percentage: reverseChargePercentage
      })
    } else {
      console.log(`Cart ${cart.id}: No metadata changes, skipping update`)
    }
  } catch (error) {
    console.error('Error in cart-updated subscriber:', error)
  }
}

export const config: SubscriberConfig = {
  event: 'cart.updated'
}


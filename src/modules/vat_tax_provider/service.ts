import { 
  ITaxProvider,
  ItemTaxCalculationLine,
  ShippingTaxCalculationLine,
  TaxCalculationContext,
  ItemTaxLineDTO,
  ShippingTaxLineDTO
} from "@medusajs/framework/types"
import { ModuleOptions } from "./types"

class VatTaxProviderService implements ITaxProvider {
  static identifier = "vat_tax_provider"
  
  protected options: ModuleOptions
  
  constructor(
    _container: any,
    options: ModuleOptions
  ) {
    this.options = {
      home_country: options.home_country || "NL",
      default_tax_rate: options.default_tax_rate || 21,
      debug: options.debug || false,
    }
  }
  
  getIdentifier(): string {
    return VatTaxProviderService.identifier
  }
  
  async getTaxLines(
    itemLines: ItemTaxCalculationLine[],
    shippingLines: ShippingTaxCalculationLine[],
    context: TaxCalculationContext
  ): Promise<(ItemTaxLineDTO | ShippingTaxLineDTO)[]> {
    const taxLines: (ItemTaxLineDTO | ShippingTaxLineDTO)[] = []
    
    const shippingCountry = context.address?.country_code?.toUpperCase()
    
    if (!shippingCountry) {
      this.log("No shipping country provided, applying 0% tax")
      return this.createZeroTaxLines(itemLines, shippingLines)
    }
    
    const vatNumber = context.customer?.metadata?.vat_number as string | null
    const isCompanyCheckout = context.customer?.metadata?.is_company_checkout === true
    
    const shouldCalculateTax = await this.shouldCalculateTax(
      vatNumber,
      shippingCountry,
      isCompanyCheckout
    )
    
    this.log(`Tax calculation for ${shippingCountry}:`, {
      isCompanyCheckout,
      vatNumber: vatNumber || "none",
      shouldCalculateTax,
    })
    
    const taxRate = shouldCalculateTax ? this.options.default_tax_rate! : 0
    
    for (const line of itemLines) {
      taxLines.push({
        rate_id: this.getTaxRateId(shippingCountry, shouldCalculateTax),
        rate: taxRate,
        name: this.getTaxName(shippingCountry, shouldCalculateTax),
        code: this.getTaxCode(shippingCountry, shouldCalculateTax),
        line_item_id: line.line_item.id,
        provider_id: this.getIdentifier(),
      })
    }
    
    for (const line of shippingLines) {
      taxLines.push({
        rate_id: this.getTaxRateId(shippingCountry, shouldCalculateTax),
        rate: taxRate,
        name: this.getTaxName(shippingCountry, shouldCalculateTax),
        code: this.getTaxCode(shippingCountry, shouldCalculateTax),
        shipping_line_id: line.shipping_line.id,
        provider_id: this.getIdentifier(),
      })
    }
    
    return taxLines
  }
  
  private async shouldCalculateTax(
    vatNumber: string | null,
    shippingCountry: string,
    isCompanyCheckout: boolean
  ): Promise<boolean> {
    const homeCountry = this.options.home_country!.toUpperCase()
    
    // If shipping to home country (NL), always charge tax
    if (shippingCountry === homeCountry) {
      return true
    }
    
    // If not a company checkout, charge tax (B2C)
    if (!isCompanyCheckout) {
      return true
    }
    
    // Company checkout - check VAT number for reverse charge
    if (!vatNumber) {
      return true
    }
    
    // Valid VAT number and different EU country = reverse charge (no tax)
    // The VAT validation is handled by the cart subscriber
    // Here we just check if it's a valid format and different country
    const vatCountryCode = vatNumber.substring(0, 2).toUpperCase()
    
    // If VAT country matches shipping country and it's not home country, apply reverse charge
    if (vatCountryCode === shippingCountry && shippingCountry !== homeCountry) {
      return false // Reverse charge - don't calculate tax
    }
    
    // Otherwise charge tax
    return true
  }
  
  private createZeroTaxLines(
    itemLines: ItemTaxCalculationLine[],
    shippingLines: ShippingTaxCalculationLine[]
  ): (ItemTaxLineDTO | ShippingTaxLineDTO)[] {
    const taxLines: (ItemTaxLineDTO | ShippingTaxLineDTO)[] = []
    
    for (const line of itemLines) {
      taxLines.push({
        rate_id: "default",
        rate: 0,
        name: "No Tax",
        code: "NOTAX",
        line_item_id: line.line_item.id,
        provider_id: this.getIdentifier(),
      })
    }
    
    for (const line of shippingLines) {
      taxLines.push({
        rate_id: "default",
        rate: 0,
        name: "No Tax",
        code: "NOTAX",
        shipping_line_id: line.shipping_line.id,
        provider_id: this.getIdentifier(),
      })
    }
    
    return taxLines
  }
  
  private getTaxRateId(country: string, shouldCalculateTax: boolean): string {
    if (shouldCalculateTax) {
      return `vat_${country.toLowerCase()}_standard`
    }
    return `vat_${country.toLowerCase()}_reverse_charge`
  }
  
  private getTaxName(country: string, shouldCalculateTax: boolean): string {
    const rate = this.options.default_tax_rate
    
    if (!shouldCalculateTax) {
      return `Reverse Charge VAT (${rate}%)`
    }
    
    if (country === this.options.home_country!.toUpperCase()) {
      return `VAT (${rate}%)`
    }
    
    return `VAT (${rate}%)`
  }
  
  private getTaxCode(country: string, shouldCalculateTax: boolean): string {
    if (!shouldCalculateTax) {
      return "REVERSE_CHARGE"
    }
    return "STANDARD"
  }
  
  private log(message: string, data?: any) {
    if (this.options.debug) {
      console.log(`[VAT Tax Provider] ${message}`, data || "")
    }
  }
}

export default VatTaxProviderService

import { ITaxProvider } from "@medusajs/framework/types"

class VatTaxProviderService implements ITaxProvider {
  static identifier = "vat_tax"

  getIdentifier(): string {
    return VatTaxProviderService.identifier
  }

  async getTaxLines(
    itemLines: any[],
    shippingLines: any[],
    context: any
  ): Promise<any[]> {
    // Return empty array - actual tax calculation is handled elsewhere
    // The tax is managed through cart adjustments and metadata
    return []
  }
}

export default VatTaxProviderService


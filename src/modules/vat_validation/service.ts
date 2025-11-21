import { MedusaService } from "@medusajs/framework/utils"

type VatValidationResult = {
  valid: boolean
  country_code?: string
  vat_number?: string
  company_name?: string
  company_address?: string
  error?: string
}

class VatValidationService extends MedusaService({}) {
  /**
   * Validate a VAT number using the EU VIES service
   * @param vatNumber - The VAT number to validate (e.g., NL123456789B01)
   * @returns Validation result with company information if valid
   */
  async validateVatNumber(vatNumber: string): Promise<VatValidationResult> {
    // Clean the VAT number (remove spaces and special characters)
    const cleanVat = vatNumber.replace(/[^A-Z0-9]/gi, '').toUpperCase()

    // Extract country code (first 2 characters)
    if (cleanVat.length < 3) {
      return {
        valid: false,
        error: 'VAT number too short'
      }
    }

    const countryCode = cleanVat.substring(0, 2)
    const vatNumberOnly = cleanVat.substring(2)

    // Basic format validation
    if (!this.isValidVatFormat(countryCode, vatNumberOnly)) {
      return {
        valid: false,
        error: 'Invalid VAT number format'
      }
    }

    try {
      // Use EU VIES API to validate VAT number
      const response = await fetch('https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          countryCode: countryCode,
          vatNumber: vatNumberOnly
        })
      })

      if (!response.ok) {
        // Fallback to basic validation if VIES is unavailable
        return {
          valid: true,
          country_code: countryCode,
          vat_number: cleanVat,
          error: 'VIES service unavailable, basic validation passed'
        }
      }

      const data = await response.json()

      if (data.valid) {
        return {
          valid: true,
          country_code: countryCode,
          vat_number: cleanVat,
          company_name: data.name || undefined,
          company_address: data.address || undefined
        }
      } else {
        return {
          valid: false,
          error: 'VAT number not found in EU database'
        }
      }
    } catch (error: any) {
      console.error('VAT validation error:', error)
      
      // Fallback: If VIES is down, do basic format validation
      // In production, you might want to be more strict here
      return {
        valid: true,
        country_code: countryCode,
        vat_number: cleanVat,
        error: 'Could not verify with EU service, basic validation passed'
      }
    }
  }

  /**
   * Check if VAT format is valid for the given country
   * @param countryCode - Two letter country code
   * @param vatNumber - VAT number without country code
   * @returns true if format is valid
   */
  private isValidVatFormat(countryCode: string, vatNumber: string): boolean {
    const patterns: Record<string, RegExp> = {
      'NL': /^[0-9]{9}B[0-9]{2}$/, // Netherlands: 9 digits + B + 2 digits
      'BE': /^[0-9]{10}$/, // Belgium: 10 digits
      'DE': /^[0-9]{9}$/, // Germany: 9 digits
      'FR': /^[A-Z0-9]{2}[0-9]{9}$/, // France: 2 chars + 9 digits
      'GB': /^([0-9]{9}|[0-9]{12}|(GD|HA)[0-9]{3})$/, // UK: 9 or 12 digits or GD/HA + 3 digits
      'IT': /^[0-9]{11}$/, // Italy: 11 digits
      'ES': /^[A-Z0-9][0-9]{7}[A-Z0-9]$/, // Spain: 1 char + 7 digits + 1 char
      'AT': /^U[0-9]{8}$/, // Austria: U + 8 digits
      'DK': /^[0-9]{8}$/, // Denmark: 8 digits
      'FI': /^[0-9]{8}$/, // Finland: 8 digits
      'SE': /^[0-9]{12}$/, // Sweden: 12 digits
      'PL': /^[0-9]{10}$/, // Poland: 10 digits
      'CZ': /^[0-9]{8,10}$/, // Czech Republic: 8-10 digits
      'PT': /^[0-9]{9}$/, // Portugal: 9 digits
      'GR': /^[0-9]{9}$/, // Greece: 9 digits
      'IE': /^[0-9][A-Z0-9+*][0-9]{5}[A-Z]{1,2}$/, // Ireland: complex format
      'LU': /^[0-9]{8}$/, // Luxembourg: 8 digits
    }

    const pattern = patterns[countryCode]
    if (!pattern) {
      // Country not in our list, accept if it looks like a VAT number
      return vatNumber.length >= 8 && vatNumber.length <= 12
    }

    return pattern.test(vatNumber)
  }

  /**
   * Determine if tax should be calculated based on VAT number and country
   * EU B2B reverse charge: No VAT if valid VAT number and different EU country
   * NL domestic: Always charge VAT
   * @param vatNumber - The VAT number
   * @param shippingCountry - The shipping country code (ISO 2)
   * @param storeCountry - The store's country code (default: 'NL')
   * @returns true if tax should be calculated
   */
  async shouldCalculateTax(
    vatNumber: string | null,
    shippingCountry: string,
    storeCountry: string = 'NL'
  ): Promise<boolean> {
    // If no VAT number provided, charge tax for NL, no tax for others
    if (!vatNumber) {
      return shippingCountry.toUpperCase() === storeCountry.toUpperCase()
    }

    // Validate the VAT number
    const validation = await this.validateVatNumber(vatNumber)

    if (!validation.valid) {
      // Invalid VAT number, charge tax for NL
      return shippingCountry.toUpperCase() === storeCountry.toUpperCase()
    }

    // Valid VAT number
    const vatCountry = validation.country_code?.toUpperCase()
    const shipping = shippingCountry.toUpperCase()
    const store = storeCountry.toUpperCase()

    // If shipping to NL (store country), always charge tax
    if (shipping === store) {
      console.log(`Tax: YES - Shipping to store country (${store})`)
      return true
    }

    // Verify VAT country matches shipping country for reverse charge
    if (vatCountry !== shipping) {
      console.log(`Tax: YES - VAT country (${vatCountry}) doesn't match shipping country (${shipping})`)
      return true // Charge tax if VAT and shipping countries don't match
    }

    // If different EU country with valid VAT matching shipping country, don't charge tax (reverse charge)
    console.log(`Tax: NO - Valid EU VAT (${vatCountry}) matches shipping country, reverse charge applies`)
    return false
  }
}

export default VatValidationService


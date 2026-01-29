/**
 * Shipping rates configuration
 * Prices are in cents (EUR)
 * 
 * Example:
 * {
 *   postnl: { nl: 595, be: 795, default: 1495 },
 *   dpd: { nl: 0, be: 0, default: 0 }
 * }
 */
export type ShippingRates = Record<string, Record<string, number>>

/**
 * Options passed to the module provider
 */
export interface MatwiseFulfillmentOptions {
  // PostNL API key for integration (future use)
  postnl_api_key?: string
  // DPD API key for integration (future use)
  dpd_api_key?: string
  // Custom rates override (optional) - overrides default rates
  custom_rates?: ShippingRates
}

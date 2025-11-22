export type ModuleOptions = {
  /**
   * The home country code (ISO 2-letter code)
   * This is the country where the business is based
   * @default "NL"
   */
  home_country?: string
  
  /**
   * The default tax rate percentage
   * @default 21
   */
  default_tax_rate?: number
  
  /**
   * Whether to enable debug logging
   * @default false
   */
  debug?: boolean
}



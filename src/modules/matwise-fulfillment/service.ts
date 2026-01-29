import { AbstractFulfillmentProviderService } from "@medusajs/framework/utils"
import {
  Logger,
  CalculateShippingOptionPriceDTO,
  FulfillmentOption,
  CalculatedShippingOptionPrice,
  CreateShippingOptionDTO,
  CreateFulfillmentResult,
  FulfillmentItemDTO,
  FulfillmentOrderDTO,
  FulfillmentDTO
} from "@medusajs/framework/types"
import {
  MatwiseFulfillmentOptions,
  ShippingRates
} from "./types"

type InjectedDependencies = {
  logger: Logger
}

/**
 * Default shipping rates by country code (in EUR, cents)
 * These can be overridden via module options
 */
const DEFAULT_SHIPPING_RATES: ShippingRates = {
  // PostNL rates by country (standard products)
  postnl: {
    nl: 595,      // Netherlands - €5.95
    be: 795,      // Belgium - €7.95
    de: 995,      // Germany - €9.95
    fr: 1195,     // France - €11.95
    lu: 795,      // Luxembourg - €7.95
    at: 1195,     // Austria - €11.95
    es: 1495,     // Spain - €14.95
    it: 1495,     // Italy - €14.95
    pt: 1495,     // Portugal - €14.95
    // Default for other EU countries
    default: 1495
  },
  // DPD rates (Mercury products - free shipping)
  dpd: {
    nl: 0,
    be: 0,
    de: 0,
    fr: 0,
    lu: 0,
    at: 0,
    es: 0,
    it: 0,
    pt: 0,
    default: 0
  },
  // PostNL for samples (same rates as standard for now)
  "postnl-samples": {
    nl: 595,
    be: 795,
    de: 995,
    fr: 1195,
    lu: 795,
    at: 1195,
    es: 1495,
    it: 1495,
    pt: 1495,
    default: 1495
  }
}

class MatwiseFulfillmentProviderService extends AbstractFulfillmentProviderService {
  static identifier = "matwise-fulfillment"

  protected logger_: Logger
  protected options_: MatwiseFulfillmentOptions
  protected shippingRates_: ShippingRates

  constructor(
    { logger }: InjectedDependencies,
    options: MatwiseFulfillmentOptions
  ) {
    super()
    this.logger_ = logger
    this.options_ = options
    // Merge custom rates with defaults
    this.shippingRates_ = {
      ...DEFAULT_SHIPPING_RATES,
      ...(options.custom_rates || {})
    }
  }

  /**
   * Returns the available fulfillment options (carriers/services)
   * These are shown when creating shipping options in the admin
   */
  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return [
      {
        id: "postnl-standard",
        name: "PostNL - Standard Shipping",
        carrier: "postnl",
        service_type: "standard",
      },
      {
        id: "postnl-samples",
        name: "PostNL - Sample Shipping",
        carrier: "postnl",
        service_type: "samples",
      },
      {
        id: "dpd-mercury",
        name: "DPD - Mercury (Free)",
        carrier: "dpd",
        service_type: "mercury",
        is_free: true,
      },
    ]
  }

  /**
   * Validates if we can calculate the price for a shipping option
   */
  async canCalculate(data: CreateShippingOptionDTO): Promise<boolean> {
    const optionId = data.data?.id as string
    // We can calculate prices for all our fulfillment options
    return ["postnl-standard", "postnl-samples", "dpd-mercury"].includes(optionId)
  }

  /**
   * Calculates the shipping price based on destination country
   */
  async calculatePrice(
    optionData: CalculateShippingOptionPriceDTO["optionData"],
    data: CalculateShippingOptionPriceDTO["data"],
    context: CalculateShippingOptionPriceDTO["context"]
  ): Promise<CalculatedShippingOptionPrice> {
    const optionId = optionData.id as string
    const countryCode = context.shipping_address?.country_code?.toLowerCase() || "nl"

    this.logger_.info(`[Matwise Fulfillment] Calculating price for ${optionId} to ${countryCode}`)

    // Determine which rate table to use
    let rateKey = "postnl"
    if (optionId === "dpd-mercury") {
      rateKey = "dpd"
    } else if (optionId === "postnl-samples") {
      rateKey = "postnl-samples"
    }

    const rates = this.shippingRates_[rateKey] || this.shippingRates_["postnl"]
    const priceInCents = rates[countryCode] ?? rates.default ?? 0

    // Convert cents to major units (Medusa v2 uses major units)
    const priceInEuros = priceInCents / 100

    this.logger_.info(`[Matwise Fulfillment] Price for ${optionId} to ${countryCode}: €${priceInEuros}`)

    return {
      calculated_amount: priceInEuros,
      is_calculated_price_tax_inclusive: true,
    }
  }

  /**
   * Validates the shipping option data when creating a shipping option
   */
  async validateOption(data: Record<string, unknown>): Promise<boolean> {
    // Validate that the option ID is one we support
    const optionId = data.id as string
    return ["postnl-standard", "postnl-samples", "dpd-mercury"].includes(optionId)
  }

  /**
   * Validates fulfillment data when adding a shipping method to cart
   */
  async validateFulfillmentData(
    optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    context: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    // Store the carrier info in the shipping method data
    return {
      ...data,
      carrier: optionData.carrier || "postnl",
      service_type: optionData.service_type || "standard",
    }
  }

  /**
   * Creates a fulfillment (when order is shipped)
   * This is where you'd integrate with PostNL/DPD APIs to create shipments
   */
  async createFulfillment(
    data: Record<string, unknown>,
    items: Partial<Omit<FulfillmentItemDTO, "fulfillment">>[],
    order: Partial<FulfillmentOrderDTO> | undefined,
    fulfillment: Partial<Omit<FulfillmentDTO, "provider_id" | "data" | "items">>
  ): Promise<CreateFulfillmentResult> {
    const carrier = data.carrier as string || "postnl"

    this.logger_.info(`[Matwise Fulfillment] Creating fulfillment with ${carrier}`)

    // TODO: Integrate with actual carrier APIs (PostNL/DPD)
    // For now, we return a mock tracking number
    const trackingNumber = `${carrier.toUpperCase()}-${Date.now()}`

    return {
      data: {
        carrier,
        tracking_number: trackingNumber,
        // Add any other data from the carrier API response
      },
      labels: []
    }
  }

  /**
   * Creates a fulfillment for a return
   */
  async createReturnFulfillment(
    fulfillment: Record<string, unknown>
  ): Promise<CreateFulfillmentResult> {
    const data = fulfillment.data as Record<string, unknown> || {}
    const carrier = data.carrier as string || "postnl"

    this.logger_.info(`[Matwise Fulfillment] Creating return fulfillment with ${carrier}`)

    // TODO: Integrate with carrier APIs for return labels
    const trackingNumber = `${carrier.toUpperCase()}-RET-${Date.now()}`

    return {
      data: {
        ...data,
        return_tracking_number: trackingNumber,
      },
      labels: []
    }
  }

  /**
   * Cancels a fulfillment
   */
  async cancelFulfillment(data: Record<string, unknown>): Promise<void> {
    const trackingNumber = data.tracking_number as string
    this.logger_.info(`[Matwise Fulfillment] Cancelling fulfillment ${trackingNumber}`)

    // TODO: Integrate with carrier APIs to cancel shipment if possible
  }

  /**
   * Retrieves fulfillment documents (labels, invoices, etc.)
   */
  async getFulfillmentDocuments(data: Record<string, unknown>): Promise<never[]> {
    // TODO: Retrieve documents from carrier APIs
    return []
  }

  async getReturnDocuments(data: Record<string, unknown>): Promise<never[]> {
    return []
  }

  async getShipmentDocuments(data: Record<string, unknown>): Promise<never[]> {
    return []
  }

  async retrieveDocuments(
    fulfillmentData: Record<string, unknown>,
    documentType: string
  ): Promise<void> {
    // TODO: Retrieve specific document types from carrier APIs
  }
}

export default MatwiseFulfillmentProviderService

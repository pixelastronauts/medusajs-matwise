import {
  AbstractPaymentProvider,
  BigNumber,
  MedusaError,
  PaymentActions,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"
import type { Logger } from "@medusajs/framework/types"
import createMollieClient, {
  CaptureMethod,
  PaymentStatus,
  OrderStatus,
  type MollieClient,
  type PaymentCreateParams,
  type PaymentMethod,
  type OrderCreateParams,
} from "@mollie/api-client"

export interface MollieOptions {
  apiKey: string
  redirectUrl: string
  medusaUrl: string
  autoCapture?: boolean
  description?: string
  debug?: boolean
}

export interface PaymentOptions {
  method?: PaymentMethod
  webhookUrl?: string
  captureMethod?: CaptureMethod
  useOrdersApi?: boolean // For Klarna and other order-based methods
}

/**
 * Base implementation of Mollie Payment Provider for Medusa
 */
abstract class MollieBase extends AbstractPaymentProvider<MollieOptions> {
  protected logger_: Logger
  protected options_: MollieOptions
  protected client_: MollieClient
  protected debug_: boolean

  abstract get paymentCreateOptions(): PaymentOptions

  static validateOptions(options: MollieOptions) {
    if (!options.apiKey || !options.redirectUrl || !options.medusaUrl) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "API key, redirect URL, and Medusa URL are required in the provider's options."
      )
    }
  }

  constructor(container: { logger: Logger }, options: MollieOptions) {
    super(container, options)
    this.logger_ = container.logger
    this.options_ = options
    this.debug_ =
      options.debug ||
      process.env.NODE_ENV === "development" ||
      process.env.NODE_ENV === "test" ||
      false

    this.client_ = createMollieClient({
      apiKey: options.apiKey,
    })
  }

  protected normalizePaymentCreateParams() {
    const res: Partial<PaymentCreateParams> = {}

    if (this.paymentCreateOptions.method) {
      res.method = this.paymentCreateOptions.method
    }

    res.webhookUrl = this.paymentCreateOptions.webhookUrl

    res.captureMode =
      this.paymentCreateOptions.captureMethod ??
      (this.options_.autoCapture !== false
        ? CaptureMethod.automatic
        : CaptureMethod.manual)

    return res
  }

  async initiatePayment({
    context,
    amount,
    currency_code,
  }: {
    context?: any
    amount: number
    currency_code: string
  }) {
    const normalizedParams = this.normalizePaymentCreateParams()
    
    // Try to get address from multiple sources:
    // 1. Direct billing_address (injected by middleware)
    // 2. shipping_address as fallback
    // 3. customer.billing_address (legacy)
    const billingAddress = 
      context?.billing_address ||
      context?.shipping_address ||
      context?.customer?.billing_address ||
      context?.customer?.shipping_address
    
    const email = context?.email || context?.customer?.email
    
    this.debug_ && this.logger_.info(`Mollie payment context keys: ${JSON.stringify(Object.keys(context || {}))}`)
    this.debug_ && this.logger_.info(`Mollie billing address: ${JSON.stringify(billingAddress)}`)
    this.debug_ && this.logger_.info(`Mollie email: ${email}`)
    
    // For Klarna and other order-based methods, use the Orders API
    if (this.paymentCreateOptions.useOrdersApi) {
      return this.initiateOrderPayment({ context, amount, currency_code, billingAddress, email })
    }
    
    try {
      const createParams: PaymentCreateParams = {
        ...normalizedParams,
        billingAddress: {
          givenName: billingAddress?.first_name || "",
          familyName: billingAddress?.last_name || "",
          email: email || "",
          streetAndNumber: billingAddress?.address_1 || "",
          postalCode: billingAddress?.postal_code || "",
          city: billingAddress?.city || "",
          country: billingAddress?.country_code?.toUpperCase() || "",
        },
        billingEmail: email || "",
        amount: {
          value: parseFloat(amount.toString()).toFixed(2),
          currency: currency_code.toUpperCase(),
        },
        description: this.options_.description || "Mollie payment created by Medusa",
        redirectUrl: this.options_.redirectUrl,
        metadata: {
          idempotency_key: context?.idempotency_key,
        },
      }

      const data = await this.client_.payments.create(createParams)

      // Extract checkout URL from the payment response
      const checkoutUrl = (data as any)._links?.checkout?.href || (data as any).links?.checkout?.href

      this.debug_ &&
        this.logger_.info(
          `Mollie payment ${data.id} successfully created with amount ${amount}, checkout URL: ${checkoutUrl}`
        )

      return {
        id: data.id,
        data: {
          ...data as unknown as Record<string, unknown>,
          // Explicitly include checkout URL for frontend
          checkout_url: checkoutUrl,
        },
      }
    } catch (error: any) {
      this.logger_.error(`Error initiating Mollie payment: ${error.message}`)
      throw error
    }
  }

  protected async initiateOrderPayment({
    context,
    amount,
    currency_code,
    billingAddress,
    email,
  }: {
    context?: any
    amount: number
    currency_code: string
    billingAddress?: any
    email?: string
  }) {
    const normalizedParams = this.normalizePaymentCreateParams()
    const currencyUpper = currency_code.toUpperCase()
    
    // Get cart items from context
    const items = context?.items || context?.cart?.items || []
    
    // Helper to extract numeric value from BigNumber or regular number
    const getNumericValue = (value: any): number => {
      if (value === null || value === undefined) return 0
      if (typeof value === 'number') return value
      if (typeof value === 'object' && 'numeric_' in value) return value.numeric_
      if (typeof value === 'object' && 'value' in value) return Number(value.value)
      return Number(value)
    }
    
    this.debug_ && this.logger_.info(`Mollie order items count: ${items.length}`)
    this.debug_ && this.logger_.info(`Mollie order amount: ${amount}`)
    if (items.length > 0) {
      const firstItemPrice = getNumericValue(items[0].unit_price)
      this.debug_ && this.logger_.info(`Mollie first item unit_price: ${firstItemPrice}, quantity: ${items[0].quantity}`)
    }
    
    // Build order lines from cart items
    // Note: Medusa amounts are in decimal format (e.g., 132.00 for €132.00)
    const lines: OrderCreateParams["lines"] = items.length > 0 
      ? items.map((item: any) => {
          const unitPrice = getNumericValue(item.unit_price)
          const quantity = item.quantity || 1
          return {
            name: item.product_title || item.title || item.variant?.title || "Product",
            quantity,
            unitPrice: {
              value: unitPrice.toFixed(2),
              currency: currencyUpper,
            },
            totalAmount: {
              value: (unitPrice * quantity).toFixed(2),
              currency: currencyUpper,
            },
            vatRate: "0.00",
            vatAmount: {
              value: "0.00",
              currency: currencyUpper,
            },
          }
        })
      : [{
          // Fallback: create a single line item with the total amount
          name: this.options_.description || "Order",
          quantity: 1,
          unitPrice: {
            value: parseFloat(amount.toString()).toFixed(2),
            currency: currencyUpper,
          },
          totalAmount: {
            value: parseFloat(amount.toString()).toFixed(2),
            currency: currencyUpper,
          },
          vatRate: "0.00",
          vatAmount: {
            value: "0.00",
            currency: currencyUpper,
          },
        }]

    try {
      const orderParams: OrderCreateParams = {
        amount: {
          value: parseFloat(amount.toString()).toFixed(2),
          currency: currencyUpper,
        },
        orderNumber: context?.idempotency_key || `order-${Date.now()}`,
        lines,
        billingAddress: {
          givenName: billingAddress?.first_name || "",
          familyName: billingAddress?.last_name || "",
          email: email || "",
          streetAndNumber: billingAddress?.address_1 || "",
          postalCode: billingAddress?.postal_code || "",
          city: billingAddress?.city || "",
          country: billingAddress?.country_code?.toUpperCase() || "",
        },
        redirectUrl: this.options_.redirectUrl,
        locale: "nl_NL",
        method: normalizedParams.method,
        metadata: {
          idempotency_key: context?.idempotency_key,
        },
      }

      if (normalizedParams.webhookUrl) {
        orderParams.webhookUrl = normalizedParams.webhookUrl
      }

      this.debug_ && this.logger_.info(`Creating Mollie order: ${JSON.stringify(orderParams)}`)

      const data = await this.client_.orders.create(orderParams)

      // Extract checkout URL from the order response
      const checkoutUrl = (data as any)._links?.checkout?.href || (data as any).links?.checkout?.href

      this.debug_ &&
        this.logger_.info(
          `Mollie order ${data.id} successfully created with amount ${amount}, checkout URL: ${checkoutUrl}`
        )

      return {
        id: data.id,
        data: { 
          ...data as unknown as Record<string, unknown>,
          isOrder: true, // Flag to indicate this is an order, not a payment
          // Explicitly include checkout URL for frontend
          checkout_url: checkoutUrl,
        },
      }
    } catch (error: any) {
      this.logger_.error(`Error initiating Mollie order: ${error.message}`)
      throw error
    }
  }

  async authorizePayment(input: { data?: any }) {
    const externalId = input.data?.id
    const isOrder = input.data?.isOrder

    if (!externalId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Payment ID is required"
      )
    }

    try {
      const { status } = await this.getPaymentStatus({
        data: { id: externalId, isOrder },
      })

      if (!["captured", "authorized", "paid"].includes(status)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Payment is not authorized: current status is ${status}`
        )
      }

      return {
        data: input.data,
        status,
      }
    } catch (error: any) {
      this.logger_.error(`Error authorizing payment ${externalId}: ${error.message}`)
      throw error
    }
  }

  async capturePayment(input: { data?: any }) {
    const externalId = input.data?.id
    const isOrder = input.data?.isOrder

    if (!externalId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Payment ID is required"
      )
    }

    try {
      // Handle orders (Klarna)
      if (isOrder || externalId.startsWith("ord_")) {
        const order = await this.client_.orders.get(externalId)
        
        // For orders, capture happens automatically when paid or we can ship
        const { status: newStatus } = await this.getPaymentStatus({
          data: { id: externalId, isOrder: true },
        })

        if (newStatus !== PaymentSessionStatus.CAPTURED) {
          throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            `Order is not captured: current status is ${newStatus}`
          )
        }

        return {
          data: { ...order as unknown as Record<string, unknown>, isOrder: true },
        }
      }

      // Handle payments
      const data = await this.client_.payments.get(externalId)
      let status = data.status
      const captureMode = data.captureMode

      if (
        status === PaymentStatus.authorized &&
        captureMode === CaptureMethod.manual
      ) {
        await this.client_.paymentCaptures.create({
          paymentId: externalId,
        })
      }

      const { status: newStatus } = await this.getPaymentStatus({
        data: { id: externalId },
      })

      if (newStatus !== PaymentSessionStatus.CAPTURED) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Payment is not captured: current status is ${newStatus}`
        )
      }

      const payment = await this.client_.payments.get(externalId)

      return {
        data: payment as unknown as Record<string, unknown>,
      }
    } catch (error: any) {
      this.logger_.error(`Error capturing payment ${externalId}: ${error.message}`)
      throw error
    }
  }

  async refundPayment(input: { data?: any; amount?: number }) {
    const externalId = input.data?.id
    const isOrder = input.data?.isOrder

    if (!externalId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Payment ID is required"
      )
    }

    try {
      // Handle orders (Klarna)
      if (isOrder || externalId.startsWith("ord_")) {
        const order = await this.client_.orders.get(externalId)
        const value = input.amount || input.data?.amount?.value
        const currency = order.amount?.currency

        if (!currency) {
          throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            "Currency information is missing from order data"
          )
        }

        // For orders, we need to refund all lines - creating a refund for the full amount
        const refund = await this.client_.orderRefunds.create({
          orderId: externalId,
          lines: [], // Empty array means refund all
        })

        return {
          data: { ...refund as unknown as Record<string, unknown>, isOrder: true },
        }
      }

      // Handle payments
      const payment = await this.client_.payments.get(externalId)
      const value = input.amount || input.data?.amount?.value
      const currency = payment.amount?.currency

      if (!currency) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Currency information is missing from payment data"
        )
      }

      const refund = await this.client_.paymentRefunds.create({
        paymentId: externalId,
        amount: {
          value: parseFloat(value.toString()).toFixed(2),
          currency: currency.toUpperCase(),
        },
      })

      return {
        data: { ...refund } as unknown as Record<string, unknown>,
      }
    } catch (error: any) {
      this.logger_.error(`Error refunding payment ${externalId}: ${error.message}`)
      throw error
    }
  }

  async cancelPayment(input: { data?: any }) {
    const id = input.data?.id
    const isOrder = input.data?.isOrder

    if (!id) {
      return { data: input.data }
    }

    try {
      // Handle orders
      if (isOrder || id.startsWith("ord_")) {
        const order = await this.client_.orders.get(id)

        if (order.status === OrderStatus.expired || order.status === OrderStatus.canceled) {
          return { data: { id, isOrder: true } as Record<string, unknown> }
        }

        const newOrder = await this.client_.orders.cancel(id).catch((error) => {
          this.logger_.warn(`Could not cancel Mollie order ${id}: ${error.message}`)
          return order
        })

        return {
          data: { ...newOrder as unknown as Record<string, unknown>, isOrder: true },
        }
      }

      // Handle payments
      const payment = await this.client_.payments.get(id)

      if (payment.status === PaymentStatus.expired) {
        return { data: { id } as Record<string, unknown> }
      }

      const newPayment = await this.client_.payments.cancel(id).catch((error) => {
        this.logger_.warn(`Could not cancel Mollie payment ${id}: ${error.message}`)
        return payment
      })

      return {
        data: newPayment as unknown as Record<string, unknown>,
      }
    } catch (error: any) {
      this.logger_.error(`Error cancelling payment ${id}: ${error.message}`)
      throw error
    }
  }

  async deletePayment(input: { data?: any }) {
    return this.cancelPayment(input)
  }

  async getPaymentStatus(input: { data?: any }) {
    const id = input.data?.id
    const isOrder = input.data?.isOrder

    if (!id) {
      return { status: PaymentSessionStatus.ERROR }
    }

    try {
      if (isOrder || id.startsWith("ord_")) {
        const order = await this.client_.orders.get(id)
        const status = order.status

        const orderStatusMap: Record<string, PaymentSessionStatus> = {
          [OrderStatus.created]: PaymentSessionStatus.REQUIRES_MORE,
          [OrderStatus.pending]: PaymentSessionStatus.PENDING,
          [OrderStatus.authorized]: PaymentSessionStatus.AUTHORIZED,
          [OrderStatus.paid]: PaymentSessionStatus.CAPTURED,
          [OrderStatus.shipping]: PaymentSessionStatus.CAPTURED,
          [OrderStatus.completed]: PaymentSessionStatus.CAPTURED,
          [OrderStatus.expired]: PaymentSessionStatus.ERROR,
          [OrderStatus.canceled]: PaymentSessionStatus.CANCELED,
        }

        return {
          status: orderStatusMap[status] || PaymentSessionStatus.PENDING,
        }
      }

      const { status } = await this.client_.payments.get(id)

      const statusMap: Record<string, PaymentSessionStatus> = {
        [PaymentStatus.open]: PaymentSessionStatus.REQUIRES_MORE,
        [PaymentStatus.canceled]: PaymentSessionStatus.CANCELED,
        [PaymentStatus.pending]: PaymentSessionStatus.PENDING,
        [PaymentStatus.authorized]: PaymentSessionStatus.AUTHORIZED,
        [PaymentStatus.expired]: PaymentSessionStatus.ERROR,
        [PaymentStatus.failed]: PaymentSessionStatus.ERROR,
        [PaymentStatus.paid]: PaymentSessionStatus.CAPTURED,
      }

      return {
        status: statusMap[status] || PaymentSessionStatus.PENDING,
      }
    } catch (error: any) {
      this.logger_.error(
        `Error retrieving payment status for ${id}: ${error.message}`
      )
      throw error
    }
  }

  async retrievePayment(input: { data?: any }) {
    const id = input.data?.id
    const isOrder = input.data?.isOrder

    if (!id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Payment ID is required"
      )
    }

    try {
      if (isOrder || id.startsWith("ord_")) {
        const data = await this.client_.orders.get(id)
        return { data: { ...data as unknown as Record<string, unknown>, isOrder: true } }
      }

      const data = await this.client_.payments.get(id)
      return { data: data as unknown as Record<string, unknown> }
    } catch (error: any) {
      this.logger_.error(
        `Error retrieving Mollie payment ${id}: ${error.message}`
      )
      throw error
    }
  }

  async updatePayment(input: { data?: any }) {
    const { id, description, redirectUrl, cancelUrl, webhookUrl, metadata } =
      input.data || {}

    if (!id) {
      return { data: input.data }
    }

    try {
      const data = await this.client_.payments.update(id, {
        description,
        redirectUrl,
        cancelUrl,
        webhookUrl,
        metadata,
      })

      return { data: data as unknown as Record<string, unknown> }
    } catch (error: any) {
      this.logger_.error(`Error updating Mollie payment ${id}: ${error.message}`)
      throw error
    }
  }

  async getWebhookActionAndData(payload: {
    data: Record<string, unknown>
    rawData: string | Buffer
    headers: Record<string, unknown>
  }) {
    const id = payload.data?.id as string

    this.debug_ && this.logger_.info(`Mollie webhook received with ID: ${id}, payload: ${JSON.stringify(payload.data)}`)

    if (!id) {
      this.logger_.warn("Mollie webhook received without ID")
      return { action: PaymentActions.NOT_SUPPORTED }
    }

    try {
      // Check if this is an order (starts with ord_) or a payment (starts with tr_)
      if (id.startsWith("ord_")) {
        this.debug_ && this.logger_.info(`Processing Mollie ORDER webhook for: ${id}`)
        return this.getOrderWebhookActionAndData(id)
      }

      this.debug_ && this.logger_.info(`Processing Mollie PAYMENT webhook for: ${id}`)

      const payment = await this.client_.payments.get(id)
      const status = payment.status
      const session_id = (payment.metadata as any)?.idempotency_key
      const amount = new BigNumber(payment.amount as any)

      const baseData = {
        amount,
        session_id,
        ...(payment as unknown as Record<string, unknown>),
      }

      switch (status) {
        case PaymentStatus.authorized:
          return { action: PaymentActions.AUTHORIZED, data: baseData }
        case PaymentStatus.paid:
          return { action: PaymentActions.SUCCESSFUL, data: baseData }
        case PaymentStatus.expired:
        case PaymentStatus.failed:
          return { action: PaymentActions.FAILED, data: baseData }
        case PaymentStatus.canceled:
          return { action: PaymentActions.CANCELED, data: baseData }
        case PaymentStatus.pending:
          return { action: PaymentActions.PENDING, data: baseData }
        case PaymentStatus.open:
          return { action: PaymentActions.REQUIRES_MORE, data: baseData }
        default:
          return { action: PaymentActions.NOT_SUPPORTED, data: baseData }
      }
    } catch (error: any) {
      this.logger_.error(
        `Error processing webhook for payment ${id}: ${error.message}`
      )
      throw error
    }
  }

  protected async getOrderWebhookActionAndData(orderId: string) {
    try {
      const order = await this.client_.orders.get(orderId)
      const status = order.status
      const session_id = (order.metadata as any)?.idempotency_key
      const amount = new BigNumber(order.amount as any)

      this.debug_ && this.logger_.info(`Mollie order ${orderId} status: ${status}, session_id: ${session_id}`)

      const baseData = {
        amount,
        session_id,
        isOrder: true,
        ...(order as unknown as Record<string, unknown>),
      }

      switch (status) {
        case OrderStatus.authorized:
          return { action: PaymentActions.AUTHORIZED, data: baseData }
        case OrderStatus.paid:
        case OrderStatus.shipping:
        case OrderStatus.completed:
          return { action: PaymentActions.SUCCESSFUL, data: baseData }
        case OrderStatus.expired:
          return { action: PaymentActions.FAILED, data: baseData }
        case OrderStatus.canceled:
          return { action: PaymentActions.CANCELED, data: baseData }
        case OrderStatus.pending:
          return { action: PaymentActions.PENDING, data: baseData }
        case OrderStatus.created:
          return { action: PaymentActions.REQUIRES_MORE, data: baseData }
        default:
          return { action: PaymentActions.NOT_SUPPORTED, data: baseData }
      }
    } catch (error: any) {
      this.logger_.error(
        `Error processing webhook for order ${orderId}: ${error.message}`
      )
      throw error
    }
  }
}

export default MollieBase

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Custom payment session creation endpoint that injects cart address data
 * into the payment context for providers like Klarna that require it.
 * 
 * POST /store/payment-collections/:id/payment-sessions-with-context
 * Body: { provider_id: string }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { id: paymentCollectionId } = req.params
  const { provider_id } = req.body as { provider_id: string }

  if (!provider_id) {
    return res.status(400).json({
      type: "invalid_data",
      message: "provider_id is required",
    })
  }

  try {
    const paymentModule = req.scope.resolve(Modules.PAYMENT)
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    // Find the cart with this payment collection to get address data
    const { data: carts } = await query.graph({
      entity: "cart",
      fields: [
        "id",
        "email",
        "shipping_address.*",
        "billing_address.*",
        "customer.*",
        "payment_collection.id",
        "items.*",
        "items.variant.*",
        "items.product.*",
      ],
    })

    const cart = carts.find((c: any) => c.payment_collection?.id === paymentCollectionId)

    if (!cart) {
      return res.status(404).json({
        type: "not_found",
        message: "Cart not found for this payment collection",
      })
    }

    // Build context with address data
    // Use billing_address if set, otherwise fall back to shipping_address
    const billingAddress = cart.billing_address || cart.shipping_address
    const shippingAddress = cart.shipping_address

    const context: Record<string, any> = {
      billing_address: billingAddress,
      shipping_address: shippingAddress,
      email: cart.email,
      customer: cart.customer,
      items: cart.items, // Include items for Klarna and other order-based payment methods
    }

    // Get payment collection to retrieve amount and currency
    const paymentCollection = await paymentModule.retrievePaymentCollection(paymentCollectionId)

    console.log("Creating payment session with context:", {
      provider_id,
      hasAddress: !!billingAddress,
      email: cart.email,
      amount: paymentCollection.amount,
      currency_code: paymentCollection.currency_code,
      itemsCount: cart.items?.length || 0,
    })

    // Create payment session with enriched context
    const paymentSession = await paymentModule.createPaymentSession(
      paymentCollectionId,
      {
        provider_id,
        amount: paymentCollection.amount,
        currency_code: paymentCollection.currency_code,
        context,
      }
    )

    // Refresh the payment collection to return updated data
    const updatedPaymentCollection = await paymentModule.retrievePaymentCollection(
      paymentCollectionId,
      {
        relations: ["payment_sessions"],
      }
    )

    return res.status(200).json({
      payment_collection: updatedPaymentCollection,
    })
  } catch (error: any) {
    console.error("Error creating payment session with context:", error)
    return res.status(500).json({
      type: "unknown_error",
      message: error.message || "An error occurred creating the payment session",
    })
  }
}

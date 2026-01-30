import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Custom payment session creation endpoint that:
 * 1. Creates a payment collection if one doesn't exist
 * 2. Injects cart address data into the payment context for providers like Klarna
 * 
 * POST /store/carts/:id/payment-session
 * Body: { provider_id: string }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { id: cartId } = req.params
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
    const remoteLink = req.scope.resolve(ContainerRegistrationKeys.REMOTE_LINK)

    // Get cart with all necessary data including computed totals
    const { data: [cart] } = await query.graph({
      entity: "cart",
      filters: { id: cartId },
      fields: [
        "id",
        "email",
        "currency_code",
        "region_id",
        "total",
        "subtotal",
        "shipping_address.*",
        "billing_address.*",
        "customer.*",
        "payment_collection.*",
        "payment_collection.payment_sessions.*",
        "items.*",
        "items.unit_price",
        "items.quantity",
        "items.variant.*",
        "items.product.*",
      ],
    })

    if (!cart) {
      return res.status(404).json({
        type: "not_found",
        message: "Cart not found",
      })
    }

    // Calculate cart total - use computed total or calculate from items
    let cartTotal: number
    if (cart.total && Number(cart.total) > 0) {
      // Handle BigNumber or regular number
      cartTotal = typeof cart.total === 'object' && 'numeric_' in cart.total
        ? (cart.total as any).numeric_
        : Number(cart.total)
    } else {
      // Calculate from items if total not available
      cartTotal = cart.items?.reduce((sum: number, item: any) => {
        const unitPrice = typeof item.unit_price === 'object' && 'numeric_' in item.unit_price
          ? (item.unit_price as any).numeric_
          : Number(item.unit_price)
        return sum + (unitPrice * item.quantity)
      }, 0) || 0
    }

    console.log("Cart total calculated:", cartTotal)

    let paymentCollectionId = cart.payment_collection?.id

    // Create payment collection if it doesn't exist
    if (!paymentCollectionId) {
      console.log("Creating payment collection for cart:", cartId)

      const [paymentCollection] = await paymentModule.createPaymentCollections([{
        currency_code: cart.currency_code,
        amount: cartTotal,
      }])

      paymentCollectionId = paymentCollection.id

      // Link the payment collection to the cart
      await remoteLink.create({
        [Modules.CART]: { cart_id: cartId },
        [Modules.PAYMENT]: { payment_collection_id: paymentCollectionId },
      })

      console.log("Payment collection created:", paymentCollectionId)
    }

    // Get the payment collection with current amount
    let paymentCollection = await paymentModule.retrievePaymentCollection(paymentCollectionId)

    // Get numeric value from payment collection amount (could be BigNumber)
    const collectionAmount = typeof paymentCollection.amount === 'object' && 'numeric_' in (paymentCollection.amount as any)
      ? (paymentCollection.amount as any).numeric_
      : Number(paymentCollection.amount)

    // Update payment collection amount if it's 0 or doesn't match cart total
    if (!collectionAmount || collectionAmount === 0 || collectionAmount !== cartTotal) {
      console.log("Updating payment collection amount from", collectionAmount, "to", cartTotal)
      // updatePaymentCollections returns an object, not an array
      paymentCollection = await paymentModule.updatePaymentCollections(
        { id: paymentCollectionId },
        { amount: cartTotal }
      ) as any
    }

    // Build context with address data
    const billingAddress = cart.billing_address || cart.shipping_address
    const shippingAddress = cart.shipping_address

    const context: Record<string, any> = {
      billing_address: billingAddress,
      shipping_address: shippingAddress,
      email: cart.email,
      customer: cart.customer,
      items: cart.items,
    }

    console.log("Creating payment session with context:", {
      provider_id,
      paymentCollectionId,
      hasAddress: !!billingAddress,
      email: cart.email,
      amount: paymentCollection.amount,
      currency_code: paymentCollection.currency_code,
      itemsCount: cart.items?.length || 0,
    })

    // Create payment session with enriched context
    await paymentModule.createPaymentSession(
      paymentCollectionId,
      {
        provider_id,
        amount: paymentCollection.amount,
        currency_code: paymentCollection.currency_code,
        context,
        data: {}, // Required by the type, actual data is managed by the provider
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
    console.error("Error creating payment session:", error)
    return res.status(500).json({
      type: "unknown_error",
      message: error.message || "An error occurred creating the payment session",
    })
  }
}

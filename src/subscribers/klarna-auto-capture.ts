import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import createMollieClient from "@mollie/api-client"

/**
 * Automatically capture Klarna payments when an order is placed.
 * For Mollie Orders API (used by Klarna), capturing is done by creating a shipment.
 */
export default async function klarnaAutoCaptureHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  try {
    const orderId = event.data.id
    logger.info(`Klarna auto-capture: Processing order ${orderId}`)

    // Get the order with payment collection and sessions
    const { data: [order] } = await query.graph({
      entity: "order",
      filters: { id: orderId },
      fields: [
        "id",
        "payment_collections.*",
        "payment_collections.payment_sessions.*",
      ],
    })

    if (!order) {
      logger.info(`Klarna auto-capture: Order ${orderId} not found`)
      return
    }

    // Find Klarna payment session
    const klarnaSession = order.payment_collections
      ?.flatMap((pc: any) => pc.payment_sessions || [])
      ?.find((session: any) => session.provider_id?.includes("mollie-klarna"))

    if (!klarnaSession) {
      // Not a Klarna payment, skip
      return
    }

    const sessionData = klarnaSession.data as any
    const mollieOrderId = sessionData?.id

    // Must be a Mollie order (starts with ord_)
    if (!mollieOrderId || !mollieOrderId.startsWith("ord_")) {
      logger.info(`Klarna auto-capture: Not a Mollie order, skipping. ID: ${mollieOrderId}`)
      return
    }

    logger.info(`Klarna auto-capture: Found Mollie order ${mollieOrderId}`)

    // Get Mollie API key from environment or config
    const mollieApiKey = process.env.MOLLIE_API_KEY
    if (!mollieApiKey) {
      logger.error("Klarna auto-capture: MOLLIE_API_KEY not configured")
      return
    }

    const mollieClient = createMollieClient({ apiKey: mollieApiKey })

    // Get the order status
    const mollieOrder = await mollieClient.orders.get(mollieOrderId)

    if (mollieOrder.status !== "authorized") {
      logger.info(`Klarna auto-capture: Order ${mollieOrderId} is not authorized (status: ${mollieOrder.status}), skipping`)
      return
    }

    // Create a shipment to capture the payment
    // Shipping all lines captures the full amount
    logger.info(`Klarna auto-capture: Creating shipment for order ${mollieOrderId}`)

    await mollieClient.orderShipments.create({
      orderId: mollieOrderId,
      lines: [], // Empty array = ship all lines
    })

    logger.info(`Klarna auto-capture: Successfully captured payment for order ${mollieOrderId}`)
  } catch (error: any) {
    logger.error(`Klarna auto-capture error: ${error.message}`)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}

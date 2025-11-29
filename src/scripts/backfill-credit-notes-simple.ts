import { Modules } from "@medusajs/framework/utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { generateCreditNotePdfWorkflow } from "../workflows/generate-credit-note-pdf"

/**
 * Simple script to create a credit note for a specific order with a known refund
 * 
 * Usage: medusa exec ./src/scripts/backfill-credit-notes-simple.ts
 */

export default async function backfillCreditNotesSimple({ container }: any) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  logger.info("🔄 Creating credit note for order #5...")

  try {
    // Get the order with payment details
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
      ],
      filters: {
        display_id: 5
      }
    })

    if (orders.length === 0) {
      logger.error("Order #5 not found")
      return
    }

    const order = orders[0]
    logger.info(`Found order: ${order.id}`)

    // For now, use a known refund ID from your system
    // You can get this from the payment refund in the UI
    const refundId = "pay_01KAGSA90HP0PSHHMQM4MM4HTE" // Replace with actual refund/payment ID
    const refundAmount = 950 // 9.50 EUR in cents

    logger.info(`Creating credit note for refund ${refundId} with amount ${refundAmount}...`)

    await generateCreditNotePdfWorkflow(container).run({
      input: {
        order_id: order.id,
        refund_id: refundId,
        amount: refundAmount,
      },
    })

    logger.info("✅ Credit note created successfully!")

  } catch (error: any) {
    logger.error("❌ Error:", error.message)
    logger.error(error)
  }
}



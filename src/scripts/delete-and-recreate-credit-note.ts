import { Modules } from "@medusajs/framework/utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { INVOICE_MODULE } from "../modules/invoice-generator"
import InvoiceGeneratorService from "../modules/invoice-generator/service"
import { InvoiceType } from "../modules/invoice-generator/models/invoice"
import { generateCreditNotePdfWorkflow } from "../workflows/generate-credit-note-pdf"

/**
 * Delete existing credit note and recreate it with correct negative amounts
 * 
 * Usage: medusa exec ./src/scripts/delete-and-recreate-credit-note.ts
 */

export default async function deleteAndRecreateCreditNote({ container }: any) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const invoiceService = container.resolve(INVOICE_MODULE) as InvoiceGeneratorService

  logger.info("🔄 Deleting and recreating credit note for order #5...")

  try {
    // Get the order
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

    // Find and delete existing credit notes for this order
    const existingCreditNotes = await invoiceService.listInvoices({
      order_id: order.id,
      type: InvoiceType.CREDIT_NOTE,
    })

    logger.info(`Found ${existingCreditNotes.length} existing credit note(s)`)

    for (const creditNote of existingCreditNotes) {
      logger.info(`Deleting credit note ${creditNote.id}...`)
      await invoiceService.deleteInvoices(creditNote.id)
    }

    // Create new credit note with correct negative amounts
    const refundId = "pay_01KAGSA90HP0PSHHMQM4MM4HTE"
    const refundAmount = 950 // 9.50 EUR in cents

    logger.info(`Creating new credit note for refund ${refundId} with amount ${refundAmount} cents (€${(refundAmount / 100).toFixed(2)})...`)

    await generateCreditNotePdfWorkflow(container).run({
      input: {
        order_id: order.id,
        refund_id: refundId,
        amount: refundAmount,
      },
    })

    logger.info("✅ Credit note recreated successfully with negative amounts!")

  } catch (error: any) {
    logger.error("❌ Error:", error.message)
    logger.error(error)
  }
}



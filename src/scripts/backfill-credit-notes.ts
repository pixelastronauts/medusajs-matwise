import { Modules } from "@medusajs/framework/utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { INVOICE_MODULE } from "../modules/invoice-generator"
import InvoiceGeneratorService from "../modules/invoice-generator/service"
import { InvoiceType } from "../modules/invoice-generator/models/invoice"
import { generateCreditNotePdfWorkflow } from "../workflows/generate-credit-note-pdf"

/**
 * Backfill Credit Notes for Existing Refunds
 * 
 * This script finds all refunded payments and creates credit notes for them
 * if they don't already have one.
 * 
 * Usage: npm run backfill:credit-notes
 * Or: medusa exec ./src/scripts/backfill-credit-notes.ts
 */

export default async function backfillCreditNotes({ container }: any) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const paymentModule = container.resolve(Modules.PAYMENT)
  const invoiceService = container.resolve(INVOICE_MODULE) as InvoiceGeneratorService
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  logger.info("🔄 Starting credit notes backfill...")

  try {
    // Get all payment collections with context (which contains order_id)
    const { data: paymentCollections } = await query.graph({
      entity: "payment_collection",
      fields: [
        "id",
        "context",
        "amount",
      ],
    })

    logger.info(`📊 Found ${paymentCollections.length} total payment collections`)

    let processedCount = 0
    let skippedCount = 0
    let errorCount = 0
    const errors: any[] = []

    // Process each payment collection
    for (const paymentCollection of paymentCollections) {
      try {
        // Get full payment collection with context and payments
        const fullPaymentCollection = await paymentModule.retrievePaymentCollection(
          paymentCollection.id,
          { relations: ["payments"] }
        ) as any

        const orderId = fullPaymentCollection.context?.order_id
        
        if (!orderId) {
          continue
        }

        const payments = fullPaymentCollection.payments || []
        
        if (payments.length === 0) {
          continue
        }
        
        logger.info(`Payment collection ${paymentCollection.id} for order ${orderId}: ${payments.length} payment(s)`)

        let hasRefunds = false

        // Process each payment
        for (const payment of payments) {
          try {
            // Get payment with refunds
            const fullPayment = await paymentModule.retrievePayment(
              payment.id,
              { relations: ["refunds"] }
            ) as any

            logger.info(`  💳 Payment ${payment.id}: ${JSON.stringify({ 
              amount: fullPayment.amount, 
              captured_at: fullPayment.captured_at,
              refundsCount: fullPayment.refunds?.length || 0 
            })}`)

            const refunds = fullPayment.refunds || []
            
            if (refunds.length === 0) {
              continue
            }

            if (!hasRefunds) {
              logger.info(`\n📦 Processing order ${orderId}`)
              hasRefunds = true
            }

            logger.info(`  💳 Payment ${payment.id} has ${refunds.length} refund(s)`)

            // Process each refund
            for (const refund of refunds) {
              const refundId = refund.id
              const refundAmount = refund.amount

              logger.info(`    📄 Checking refund ${refundId} (amount: ${refundAmount})`)

              try {
                // Check if credit note already exists for this refund
                const existingCreditNotes = await invoiceService.listInvoices({
                  order_id: orderId,
                  type: InvoiceType.CREDIT_NOTE,
                  refund_id: refundId,
                })

                if (existingCreditNotes.length > 0) {
                  logger.info(`    ✅ Credit note already exists for refund ${refundId}, skipping...`)
                  skippedCount++
                  continue
                }

                // Generate credit note
                logger.info(`    🔨 Creating credit note for refund ${refundId}...`)
                
                await generateCreditNotePdfWorkflow(container).run({
                  input: {
                    order_id: orderId,
                    refund_id: refundId,
                    amount: refundAmount,
                  },
                })

                logger.info(`    ✅ Credit note created successfully!`)
                processedCount++
              } catch (error: any) {
                logger.error(`    ❌ Error creating credit note for refund ${refundId}:`, error.message)
                errors.push({
                  orderId,
                  refundId,
                  error: error.message,
                })
                errorCount++
              }
            }
          } catch (error: any) {
            // Error getting payment details, skip
            logger.warn(`  ⚠️  Error getting payment ${payment.id}: ${error.message}`)
          }
        }
      } catch (error: any) {
        // Error getting payment collection, skip
        logger.warn(`⚠️  Error getting payment collection ${paymentCollection.id}: ${error.message}`)
      }
    }

    // Summary
    logger.info("\n" + "=".repeat(60))
    logger.info("📊 BACKFILL SUMMARY")
    logger.info("=".repeat(60))
    logger.info(`✅ Credit notes created: ${processedCount}`)
    logger.info(`⏭️  Skipped (already exists or no order): ${skippedCount}`)
    logger.info(`❌ Errors: ${errorCount}`)
    
    if (errors.length > 0) {
      logger.info("\n❌ ERRORS:")
      errors.forEach((error, index) => {
        logger.info(`${index + 1}. ${JSON.stringify(error, null, 2)}`)
      })
    }

    logger.info("=".repeat(60))
    logger.info("✅ Backfill completed!")

  } catch (error: any) {
    logger.error("❌ Fatal error during backfill:", error)
    throw error
  }
}


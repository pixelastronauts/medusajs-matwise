import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { INVOICE_MODULE } from "../../modules/invoice-generator"
import { InvoiceType } from "../../modules/invoice-generator/models/invoice"
import InvoiceGeneratorService from "../../modules/invoice-generator/service"

type StepInput = {
  order_id: string
  invoice_type?: InvoiceType
  refund_id?: string
  amount?: number
}

export const getOrderInvoiceStep = createStep(
  "get-order-invoice",
  async ({ order_id, invoice_type = InvoiceType.INVOICE, refund_id, amount }: StepInput, { container }) => {
    const invoiceGeneratorService = container.resolve(INVOICE_MODULE) as InvoiceGeneratorService

    // For credit notes, check if one already exists for this refund
    if (invoice_type === InvoiceType.CREDIT_NOTE && refund_id) {
      const [existingInvoice] = await invoiceGeneratorService.listInvoices({
        order_id,
        type: InvoiceType.CREDIT_NOTE,
        refund_id,
      })

      if (existingInvoice) {
        return new StepResponse(existingInvoice, {
          created_invoice: false,
          invoice_id: existingInvoice.id,
        })
      }
    }

    // For regular invoices, check if one already exists for this order
    if (invoice_type === InvoiceType.INVOICE) {
      const [existingInvoice] = await invoiceGeneratorService.listInvoices({
        order_id,
        type: InvoiceType.INVOICE,
      })

      if (existingInvoice) {
        return new StepResponse(existingInvoice, {
          created_invoice: false,
          invoice_id: existingInvoice.id,
        })
      }
    }

    // Create new invoice
    const invoice = await invoiceGeneratorService.createInvoices({
      order_id,
      type: invoice_type,
      refund_id: refund_id || null,
      amount: amount || 0,
      pdfContent: {},
    })

    return new StepResponse(invoice, {
      created_invoice: true,
      invoice_id: invoice.id,
    })
  },
  async (data, { container }) => {
    const { created_invoice, invoice_id } = data || {}

    if (!created_invoice || !invoice_id) {
      return
    }

    const invoiceGeneratorService = container.resolve(INVOICE_MODULE) as InvoiceGeneratorService

    invoiceGeneratorService.deleteInvoices(invoice_id)
  }
)



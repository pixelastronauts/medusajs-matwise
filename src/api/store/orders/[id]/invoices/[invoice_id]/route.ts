import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { INVOICE_MODULE } from "../../../../../../modules/invoice-generator"
import InvoiceGeneratorService from "../../../../../../modules/invoice-generator/service"
import { generateInvoicePdfWorkflow } from "../../../../../../workflows/generate-invoice-pdf"
import { generateCreditNotePdfWorkflow } from "../../../../../../workflows/generate-credit-note-pdf"
import { InvoiceType } from "../../../../../../modules/invoice-generator/models/invoice"

// GET /store/orders/:id/invoices/:invoice_id - Download a specific invoice PDF
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { id: orderId, invoice_id } = req.params

  const invoiceGeneratorService = req.scope.resolve(INVOICE_MODULE) as InvoiceGeneratorService

  // Get the invoice
  const invoice = await invoiceGeneratorService.retrieveInvoice(invoice_id)

  if (!invoice || invoice.order_id !== orderId) {
    res.status(404).json({ error: "Invoice not found" })
    return
  }

  // Generate the PDF based on invoice type
  let pdf_buffer: ArrayBuffer

  if (invoice.type === InvoiceType.CREDIT_NOTE) {
    const { result } = await generateCreditNotePdfWorkflow(req.scope).run({
      input: {
        order_id: orderId,
        refund_id: invoice.refund_id!,
        amount: Number(invoice.amount),
      },
    })
    pdf_buffer = result.pdf_buffer
  } else {
    const { result } = await generateInvoicePdfWorkflow(req.scope).run({
      input: {
        order_id: orderId,
      },
    })
    pdf_buffer = result.pdf_buffer
  }

  const buffer = Buffer.from(pdf_buffer)

  const filename = invoice.type === InvoiceType.CREDIT_NOTE 
    ? `credit-note-${invoice.display_id}.pdf`
    : `invoice-${invoice.display_id}.pdf`

  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Content-Length": buffer.length,
  })
  
  res.send(buffer)
}



import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { INVOICE_MODULE } from "../../../../../modules/invoice-generator"
import InvoiceGeneratorService from "../../../../../modules/invoice-generator/service"

// GET /admin/orders/:id/invoices - List all invoices for an order
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { id: orderId } = req.params

  const invoiceGeneratorService = req.scope.resolve(INVOICE_MODULE) as InvoiceGeneratorService

  // Get all invoices for this order
  const invoices = await invoiceGeneratorService.listInvoices({
    order_id: orderId,
  })

  // Sort by created_at descending (newest first)
  const sortedInvoices = invoices.sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  res.json({
    invoices: sortedInvoices.map(invoice => ({
      id: invoice.id,
      display_id: invoice.display_id,
      type: invoice.type,
      refund_id: invoice.refund_id,
      amount: invoice.amount,
      created_at: invoice.created_at,
    }))
  })
}



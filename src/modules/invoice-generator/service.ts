import { MedusaService } from "@medusajs/framework/utils"
import { InvoiceConfig } from "./models/invoice-config"
import { Invoice, InvoiceType } from "./models/invoice"
import PdfPrinter from "pdfmake"
import { 
  InferTypeOf, 
  OrderDTO, 
  OrderLineItemDTO,
} from "@medusajs/framework/types"
import axios from "axios"

const fonts = {
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
}

const printer = new PdfPrinter(fonts)

type GeneratePdfParams = {
  order: OrderDTO
  items: OrderLineItemDTO[]
}

class InvoiceGeneratorService extends MedusaService({
  InvoiceConfig,
  Invoice,
}) {
  private async formatAmount(amount: number, currency: string): Promise<string> {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount)
  }

  private async imageUrlToBase64(url: string): Promise<string> {
    const response = await axios.get(url, { responseType: "arraybuffer" })
    const base64 = Buffer.from(response.data).toString("base64")
    const mimeType = response.headers["content-type"] || "image/png"
    return `data:${mimeType};base64,${base64}`
  }

  private async createInvoiceContent(
    params: GeneratePdfParams, 
    invoice: InferTypeOf<typeof Invoice>
  ): Promise<Record<string, any>> {
    // Get invoice configuration
    const invoiceConfigs = await this.listInvoiceConfigs()
    const config = invoiceConfigs[0] as InferTypeOf<typeof InvoiceConfig> | undefined

    const isCreditNote = invoice.type === InvoiceType.CREDIT_NOTE
    const refundAmount = Number(invoice.amount)

    // For credit notes, create a simple refund line item instead of showing all order items
    const itemsTable = isCreditNote ? [
      [
        { text: "Item", style: "tableHeader" },
        { text: "Quantity", style: "tableHeader" },
        { text: "Unit Price", style: "tableHeader" },
        { text: "Total", style: "tableHeader" },
      ],
      [
        { text: "Refund", style: "tableRow" },
        { text: "1", style: "tableRow" },
        { text: await this.formatAmount(-refundAmount, params.order.currency_code), style: "tableRow" },
        { text: await this.formatAmount(-refundAmount, params.order.currency_code), style: "tableRow" },
      ]
    ] : [
      [
        { text: "Item", style: "tableHeader" },
        { text: "Quantity", style: "tableHeader" },
        { text: "Unit Price", style: "tableHeader" },
        { text: "Total", style: "tableHeader" },
      ],
      ...(await Promise.all(params.items.map(async (item) => [
        { text: item.title || "Unknown Item", style: "tableRow" },
        { text: item.quantity.toString(), style: "tableRow" },
        { text: await this.formatAmount(
          item.unit_price, 
          params.order.currency_code
        ), style: "tableRow" },
        { text: await this.formatAmount(
          Number(item.total), 
          params.order.currency_code
        ), style: "tableRow" },
      ]))),
    ]

    const invoicePrefix = isCreditNote ? "CN" : "INV"
    const invoiceId = `${invoicePrefix}-${invoice.display_id.toString().padStart(6, "0")}`
    const invoiceDate = new Date(invoice.created_at).toLocaleDateString()
    const documentTitle = isCreditNote ? "CREDIT NOTE" : "INVOICE"

    // return the PDF content structure
    return {
      pageSize: "A4",
      pageMargins: [40, 60, 40, 60],
      defaultStyle: {
        font: "Helvetica",
      },
      header: {
        margin: [40, 20, 40, 0],
        columns: [
          /** Company Logo */
          {
            width: "*",
            stack: [
              ...(config?.company_logo ? [
                {
                  image: await this.imageUrlToBase64(config!.company_logo!),
                  width: 80,
                  height: 40,
                  fit: [80, 40],
                  margin: [0, 0, 0, 10],
                },
              ] : []),
              {
                text: config?.company_name || "Your Company Name",
                style: "companyName",
                margin: [0, 0, 0, 0],
              },
            ],
          },
          /** Invoice Title */
          {
            width: "auto",
            stack: [
              {
                text: documentTitle,
                style: "invoiceTitle",
                alignment: "right",
              },
            ],
          },
        ],
      },
      content: [
        /** Company Details */
        {
          columns: [
            {
              width: "*",
              stack: [
                { text: config?.company_address || "", style: "companyDetails" },
                { text: config?.company_phone || "", style: "companyDetails" },
                { text: config?.company_email || "", style: "companyDetails" },
              ],
            },
            {
              width: "auto",
              stack: [
                {
                  text: [
                    { text: `${isCreditNote ? "Credit Note" : "Invoice"} #: `, bold: true },
                    { text: invoiceId },
                  ],
                  style: "invoiceDetails",
                  alignment: "right",
                },
                {
                  text: [
                    { text: "Date: ", bold: true },
                    { text: invoiceDate },
                  ],
                  style: "invoiceDetails",
                  alignment: "right",
                },
                {
                  text: [
                    { text: "Order #: ", bold: true },
                    { text: params.order.display_id.toString() },
                  ],
                  style: "invoiceDetails",
                  alignment: "right",
                },
                {
                  text: [
                    { text: "Order Date: ", bold: true },
                    { text: new Date(params.order.created_at).toLocaleDateString() },
                  ],
                  style: "invoiceDetails",
                  alignment: "right",
                },
              ],
            },
          ],
          margin: [0, 20, 0, 20],
        },

        /** Billing and Shipping Addresses */
        {
          columns: [
            {
              width: "*",
              stack: [
                { text: "Bill To:", style: "sectionHeader" },
                {
                  text: [
                    ...(params.order.billing_address?.company
                      ? [params.order.billing_address.company, "\n"]
                      : []),
                    params.order.billing_address?.first_name || "",
                    " ",
                    params.order.billing_address?.last_name || "",
                    "\n",
                    params.order.billing_address?.address_1 || "",
                    "\n",
                    ...(params.order.billing_address?.address_2
                      ? [params.order.billing_address.address_2, "\n"]
                      : []),
                    params.order.billing_address?.city || "",
                    ", ",
                    params.order.billing_address?.province || "",
                    " ",
                    params.order.billing_address?.postal_code || "",
                    "\n",
                    params.order.billing_address?.country_code || "",
                    ...(params.order.metadata?.vat_number
                      ? ["\n", "VAT: ", params.order.metadata.vat_number as string]
                      : []),
                  ],
                  style: "addressText",
                },
              ],
            },
            {
              width: "*",
              stack: [
                { text: "Ship To:", style: "sectionHeader" },
                {
                  text: [
                    ...(params.order.shipping_address?.company
                      ? [params.order.shipping_address.company, "\n"]
                      : []),
                    params.order.shipping_address?.first_name || "",
                    " ",
                    params.order.shipping_address?.last_name || "",
                    "\n",
                    params.order.shipping_address?.address_1 || "",
                    "\n",
                    ...(params.order.shipping_address?.address_2
                      ? [params.order.shipping_address.address_2, "\n"]
                      : []),
                    params.order.shipping_address?.city || "",
                    ", ",
                    params.order.shipping_address?.province || "",
                    " ",
                    params.order.shipping_address?.postal_code || "",
                    "\n",
                    params.order.shipping_address?.country_code || "",
                  ],
                  style: "addressText",
                },
              ],
            },
          ],
          margin: [0, 0, 0, 20],
        },

        /** Items Table */
        {
          table: {
            headerRows: 1,
            widths: ["*", "auto", "auto", "auto"],
            body: itemsTable,
          },
          layout: {
            fillColor: function (rowIndex: number) {
              return rowIndex === 0 ? "#f3f4f6" : null
            },
            hLineWidth: function (i: number, node: any) {
              return i === 0 || i === 1 || i === node.table.body.length ? 1 : 0
            },
            vLineWidth: function () {
              return 0
            },
          },
          margin: [0, 0, 0, 20],
        },

        /** Totals */
        {
          columns: [
            { width: "*", text: "" },
            {
              width: "auto",
              stack: isCreditNote ? [
                // For credit notes, just show the refund amount
                {
                  columns: [
                    { text: "Refund Amount:", style: "totalLabel", width: 120 },
                    {
                      text: await this.formatAmount(
                        -refundAmount,
                        params.order.currency_code
                      ),
                      style: "totalValue",
                      alignment: "right",
                      width: 100,
                    },
                  ],
                  margin: [0, 0, 0, 0],
                },
              ] : [
                // For regular invoices, show all breakdown
                {
                  columns: [
                    { text: "Subtotal:", style: "totalsLabel", width: 120 },
                    {
                      text: await this.formatAmount(
                        Number(params.order.subtotal),
                        params.order.currency_code
                      ),
                      style: "totalsValue",
                      alignment: "right",
                      width: 100,
                    },
                  ],
                  margin: [0, 0, 0, 5],
                },
                {
                  columns: [
                    { text: "Tax:", style: "totalsLabel", width: 120 },
                    {
                      text: await this.formatAmount(
                        Number(params.order.tax_total),
                        params.order.currency_code
                      ),
                      style: "totalsValue",
                      alignment: "right",
                      width: 100,
                    },
                  ],
                  margin: [0, 0, 0, 5],
                },
                {
                  columns: [
                    { text: "Shipping:", style: "totalsLabel", width: 120 },
                    {
                      text: await this.formatAmount(
                        Number(params.order.shipping_methods?.reduce((sum, method) => sum + Number(method.amount), 0) || 0),
                        params.order.currency_code
                      ),
                      style: "totalsValue",
                      alignment: "right",
                      width: 100,
                    },
                  ],
                  margin: [0, 0, 0, 5],
                },
                ...(params.order.discount_total
                  ? [
                      {
                        columns: [
                          { text: "Discount:", style: "totalsLabel", width: 120 },
                          {
                            text: await this.formatAmount(
                              -Number(params.order.discount_total),
                              params.order.currency_code
                            ),
                            style: "totalsValue",
                            alignment: "right",
                            width: 100,
                          },
                        ],
                        margin: [0, 0, 0, 5],
                      },
                    ]
                  : []),
                {
                  columns: [
                    { text: "Total:", style: "totalLabel", width: 120 },
                    {
                      text: await this.formatAmount(
                        Number(params.order.total),
                        params.order.currency_code
                      ),
                      style: "totalValue",
                      alignment: "right",
                      width: 100,
                    },
                  ],
                  margin: [0, 10, 0, 0],
                },
              ],
            },
          ],
        },

        /** Notes */
        ...(config?.notes
          ? [
              {
                text: "Notes:",
                style: "sectionHeader",
                margin: [0, 20, 0, 10],
              },
              {
                text: config.notes,
                style: "notesText",
              },
            ]
          : []),
      ],
      styles: {
        companyName: {
          fontSize: 16,
          bold: true,
        },
        companyDetails: {
          fontSize: 10,
          margin: [0, 2, 0, 2],
        },
        invoiceTitle: {
          fontSize: 24,
          bold: true,
        },
        invoiceDetails: {
          fontSize: 10,
          margin: [0, 2, 0, 2],
        },
        sectionHeader: {
          fontSize: 12,
          bold: true,
          margin: [0, 0, 0, 5],
        },
        addressText: {
          fontSize: 10,
          lineHeight: 1.3,
        },
        tableHeader: {
          fontSize: 10,
          bold: true,
          margin: [5, 5, 5, 5],
        },
        tableRow: {
          fontSize: 10,
          margin: [5, 5, 5, 5],
        },
        totalsLabel: {
          fontSize: 10,
        },
        totalsValue: {
          fontSize: 10,
        },
        totalLabel: {
          fontSize: 12,
          bold: true,
        },
        totalValue: {
          fontSize: 12,
          bold: true,
        },
        notesText: {
          fontSize: 10,
          italics: true,
        },
      },
    }
  }

  async generatePdf(params: GeneratePdfParams & {
    invoice_id: string
  }): Promise<Buffer> {
    const invoice = await this.retrieveInvoice(params.invoice_id)

    // Generate new content
    const pdfContent = Object.keys(invoice.pdfContent).length ? 
      invoice.pdfContent : 
      await this.createInvoiceContent(params, invoice)

    await this.updateInvoices({
      id: invoice.id,
      pdfContent,
    })

    // get PDF as a Buffer
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
  
      const pdfDoc = printer.createPdfKitDocument(pdfContent as any)
      
      pdfDoc.on("data", (chunk) => chunks.push(chunk))
      pdfDoc.on("end", () => {
        const result = Buffer.concat(chunks)
        resolve(result)
      })
      pdfDoc.on("error", (err) => reject(err))
  
      pdfDoc.end() // Finalize PDF stream
    })
  }
}

export default InvoiceGeneratorService


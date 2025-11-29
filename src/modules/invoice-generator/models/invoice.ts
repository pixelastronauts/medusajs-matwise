import { model } from "@medusajs/framework/utils"

export enum InvoiceType {
  INVOICE = "invoice",
  CREDIT_NOTE = "credit_note",
}

export const Invoice = model.define("invoice", {
  id: model.id().primaryKey(),
  display_id: model.autoincrement(),
  order_id: model.text(),
  type: model.enum(InvoiceType).default(InvoiceType.INVOICE),
  refund_id: model.text().nullable(),
  amount: model.bigNumber(),
  pdfContent: model.json(),
})



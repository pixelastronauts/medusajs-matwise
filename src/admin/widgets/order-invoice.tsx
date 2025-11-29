import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Button, Container, Heading, Text, toast, Badge, Table } from "@medusajs/ui"
import { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types"
import { sdk } from "../lib/sdk"
import { useState, useEffect } from "react"
import { ArrowDownTray } from "@medusajs/icons"

type Invoice = {
  id: string
  display_id: number
  type: "invoice" | "credit_note"
  refund_id: string | null
  amount: number
  created_at: string
}

const OrderInvoiceWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  useEffect(() => {
    loadInvoices()
  }, [order.id])

  const loadInvoices = async () => {
    setIsLoading(true)
    try {
      const response = await sdk.client.fetch(`/admin/orders/${order.id}/invoices`, {
        method: "GET",
      })
      // Check if response is already parsed or needs parsing
      const data = typeof response.json === 'function' ? await response.json() : response
      setInvoices(data.invoices || [])
    } catch (error) {
      console.error("Error loading invoices:", error)
      toast.error("Failed to load invoices")
    } finally {
      setIsLoading(false)
    }
  }

  const downloadInvoice = async (invoice: Invoice) => {
    setDownloadingId(invoice.id)
    
    try {
      const response: Response = await sdk.client.fetch(
        `/admin/orders/${order.id}/invoices/${invoice.id}`, 
        {
          method: "GET",
          headers: {
            "accept": "application/pdf",
          },
        }
      )
  
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      
      const filename = invoice.type === "credit_note" 
        ? `credit-note-${invoice.display_id}.pdf`
        : `invoice-${invoice.display_id}.pdf`
      
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success(`${invoice.type === "credit_note" ? "Credit note" : "Invoice"} downloaded successfully`)
    } catch (error) {
      toast.error(`Failed to download: ${error}`)
    } finally {
      setDownloadingId(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const formatAmount = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined || amount === 0) {
      return "-"
    }
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: order.currency_code || "EUR",
    }).format(amount)
  }

  if (isLoading) {
    return (
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading level="h2">Invoices & Credit Notes</Heading>
        </div>
        <div className="px-6 py-4">
          <Text size="small" className="text-ui-fg-subtle">Loading invoices...</Text>
        </div>
      </Container>
    )
  }

  if (invoices.length === 0) {
    return (
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading level="h2">Invoices & Credit Notes</Heading>
        </div>
        <div className="px-6 py-4">
          <Text size="small" className="text-ui-fg-subtle">No invoices available yet</Text>
        </div>
      </Container>
    )
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h2">Invoices & Credit Notes</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            {invoices.length} {invoices.length === 1 ? "document" : "documents"} available
          </Text>
        </div>
      </div>
      <div className="px-6 py-4">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Number</Table.HeaderCell>
              <Table.HeaderCell>Type</Table.HeaderCell>
              <Table.HeaderCell>Date</Table.HeaderCell>
              <Table.HeaderCell>Amount</Table.HeaderCell>
              <Table.HeaderCell></Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {invoices.map((invoice) => (
              <Table.Row key={invoice.id}>
                <Table.Cell>
                  <Text size="small" weight="plus">
                    {invoice.type === "credit_note" ? "CN" : "INV"}-{String(invoice.display_id).padStart(6, "0")}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Badge 
                    size="small" 
                    color={invoice.type === "credit_note" ? "orange" : "green"}
                  >
                    {invoice.type === "credit_note" ? "Credit Note" : "Invoice"}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <Text size="small">{formatDate(invoice.created_at)}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="small">
                    {invoice.type === "credit_note" ? "-" : ""}{formatAmount(Number(invoice.amount))}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Button
                    size="small"
                    variant="transparent"
                    onClick={() => downloadInvoice(invoice)}
                    isLoading={downloadingId === invoice.id}
                    disabled={!!downloadingId}
                  >
                    <ArrowDownTray />
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.side.before",
})

export default OrderInvoiceWidget



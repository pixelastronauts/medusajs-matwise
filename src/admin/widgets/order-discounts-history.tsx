import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Badge, Table, Button, toast, Prompt } from "@medusajs/ui"
import { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types"
import { useEffect, useState } from "react"
import { Trash } from "@medusajs/icons"
import { sdk } from "../lib/sdk"

const OrderDiscountsHistoryWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const [discounts, setDiscounts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [removingId, setRemovingId] = useState<string | null>(null)

  // Check if any refunds have been processed
  const orderData = order as any
  const refundedTotal = orderData.summary?.refunded_total || 0
  const hasRefunds = refundedTotal > 0

  useEffect(() => {
    loadDiscounts()
  }, [order.id])

  const loadDiscounts = async () => {
    try {
      setIsLoading(true)
      
      // Get discounts from order metadata
      const discountsHistory = (order.metadata?.discounts_history || []) as any[]
      
      // Sort by applied date, newest first
      const sortedDiscounts = [...discountsHistory].sort((a, b) => 
        new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime()
      )
      
      setDiscounts(sortedDiscounts)
    } catch (error) {
      console.error("Error loading discounts:", error)
      setDiscounts([])
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <Container className="divide-y p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading level="h2">Applied Discounts</Heading>
        </div>
        <div className="px-6 py-4 text-sm text-ui-fg-subtle">
          Loading discounts...
        </div>
      </Container>
    )
  }

  if (discounts.length === 0) {
    return null
  }

  const removeDiscount = async (discountId: string) => {
    setRemovingId(discountId)

    try {
      const response: any = await sdk.client.fetch(
        `/admin/orders/${order.id}/remove-discount`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: {
            discount_id: discountId,
          },
        }
      )

      const result = typeof response.json === 'function' ? await response.json() : response

      if (response.ok === false || result.error) {
        throw new Error(result.message || "Failed to remove discount")
      }

      toast.success("Discount removed successfully")
      
      // Refresh after short delay
      setTimeout(() => {
        window.location.reload()
      }, 500)
    } catch (error: any) {
      toast.error("Failed to remove discount", {
        description: error.message,
      })
      setRemovingId(null)
    }
  }

  const totalDiscount = discounts.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0)
  const currency = order.currency_code?.toUpperCase() || "EUR"

  return (
    <Container className="p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h2">Applied Discounts</Heading>
          <p className="text-sm text-ui-fg-subtle mt-1">
            {discounts.length} discount{discounts.length !== 1 ? 's' : ''} applied • Total: {totalDiscount.toFixed(2)} {currency}
          </p>
        </div>
      </div>
      <div>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Code</Table.HeaderCell>
              <Table.HeaderCell>Reason</Table.HeaderCell>
              <Table.HeaderCell>Type</Table.HeaderCell>
              <Table.HeaderCell>Amount</Table.HeaderCell>
              <Table.HeaderCell>Applied</Table.HeaderCell>
              <Table.HeaderCell></Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {discounts.map((discount) => (
              <Table.Row key={discount.id}>
                <Table.Cell>
                  <Badge size="small" color="purple">
                    {discount.code}
                  </Badge>
                </Table.Cell>
                <Table.Cell>{discount.reason || "No reason provided"}</Table.Cell>
                <Table.Cell className="text-sm text-ui-fg-subtle">
                  {discount.type === 'percentage' ? `${discount.percentage}%` : 'Fixed'}
                </Table.Cell>
                <Table.Cell>
                  <span className="font-medium">
                    {discount.amount.toFixed(2)} {currency}
                  </span>
                </Table.Cell>
                <Table.Cell className="text-sm text-ui-fg-subtle">
                  {new Date(discount.applied_at).toLocaleDateString()} {new Date(discount.applied_at).toLocaleTimeString()}
                </Table.Cell>
                <Table.Cell>
                  {hasRefunds ? (
                    <Button
                      variant="transparent"
                      size="small"
                      disabled
                      className="cursor-not-allowed"
                      title="Cannot remove discount after refund has been processed"
                    >
                      <Trash className="text-ui-fg-disabled" />
                    </Button>
                  ) : (
                    <Prompt>
                      <Prompt.Trigger asChild>
                        <Button
                          variant="transparent"
                          size="small"
                          disabled={removingId !== null}
                          isLoading={removingId === discount.id}
                        >
                          <Trash className="text-ui-fg-subtle" />
                        </Button>
                      </Prompt.Trigger>
                      <Prompt.Content>
                        <Prompt.Header>
                          <Prompt.Title>Remove Discount</Prompt.Title>
                          <Prompt.Description>
                            Are you sure you want to remove this discount? This will increase the order total and create an outstanding charge that the customer will need to pay.
                          </Prompt.Description>
                        </Prompt.Header>
                        <Prompt.Footer>
                          <Prompt.Cancel>Cancel</Prompt.Cancel>
                          <Prompt.Action onClick={() => removeDiscount(discount.id)}>
                            Remove Discount
                          </Prompt.Action>
                        </Prompt.Footer>
                      </Prompt.Content>
                    </Prompt>
                  )}
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
  zone: "order.details.after",
})

export default OrderDiscountsHistoryWidget


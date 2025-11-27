import { defineWidgetConfig } from "@medusajs/admin-sdk"
import {
  Button,
  Container,
  Heading,
  Text,
  toast,
  Input,
  Label,
  Textarea,
  Select,
  Badge,
} from "@medusajs/ui"
import { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types"
import { sdk } from "../lib/sdk"
import { useState } from "react"

const OrderApplyDiscountWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [discountType, setDiscountType] = useState<"percentage" | "fixed" | "code">("percentage")
  const [discountValue, setDiscountValue] = useState("")
  const [promotionCode, setPromotionCode] = useState("")
  const [reason, setReason] = useState("")

  // Don't show widget for canceled orders
  if (order.status === "canceled") {
    return null
  }

  const applyDiscount = async () => {
    if (!discountValue && !promotionCode) {
      toast.error("Please enter a discount value or promotion code")
      return
    }

    // Validate discount doesn't exceed order total
    if (discountType === "percentage" && parseFloat(discountValue) > 100) {
      toast.error("Discount percentage cannot exceed 100%")
      return
    }

    if (discountType === "fixed" && parseFloat(discountValue) > orderTotal) {
      toast.error(`Discount amount cannot exceed order total of ${orderTotal.toFixed(2)} ${currency}`)
      return
    }

    setIsLoading(true)

    try {
      const body: {
        discount_amount?: number
        discount_percentage?: number
        promotion_codes?: string[]
        reason?: string
      } = {
        reason: reason || "Retroactive discount applied",
      }

      if (discountType === "code" && promotionCode) {
        body.promotion_codes = [promotionCode]
      } else if (discountType === "percentage") {
        const percentage = parseFloat(discountValue)
        // Calculate the actual discount amount in the same unit as order total
        body.discount_amount = (orderTotal * percentage) / 100
      } else if (discountType === "fixed") {
        body.discount_amount = parseFloat(discountValue)
      }

      const response: any = await sdk.client.fetch(
        `/admin/orders/${order.id}/apply-discount-via-edit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: body,
        }
      )

      // SDK might return already parsed JSON or a Response object
      const result = typeof response.json === 'function' ? await response.json() : response

      if (response.ok === false || result.error) {
        throw new Error(result.message || "Failed to apply discount")
      }

      // Show success message
      if (result.requires_refund && result.refund_amount > 0) {
        toast.success("Discount applied successfully!", {
          description: `A refund of ${result.refund_amount.toFixed(2)} ${result.currency_code?.toUpperCase()} is available and requires processing.`,
          duration: 8000,
        })
      } else {
        toast.success(result.message || "Discount applied successfully!", {
          duration: 5000,
        })
      }

      // Reset form and close
      setDiscountValue("")
      setPromotionCode("")
      setReason("")
      setIsOpen(false)

      // The order data should automatically refresh since we confirmed an order edit
      // which increments the order version and triggers Medusa's data refetch
    } catch (error: any) {
      toast.error("Failed to apply discount", {
        description: error.message,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const orderTotal = parseFloat(order.total)
  const currency = order.currency_code?.toUpperCase()

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex-1">
          <Heading level="h2">Apply Discount</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Apply a discount or promotion to this existing order
          </Text>
        </div>
      </div>

      {!isOpen ? (
        <div className="flex items-center justify-end px-6 py-4">
          <Button
            variant="secondary"
            onClick={() => setIsOpen(true)}
          >
            Apply Discount
          </Button>
        </div>
      ) : (
        <div className="px-6 py-4 space-y-4">
          <div>
            <Label className="mb-2">Discount Type</Label>
            <Select
              value={discountType}
              onValueChange={(value: any) => setDiscountType(value)}
            >
              <Select.Trigger>
                <Select.Value placeholder="Select discount type" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="percentage">Percentage</Select.Item>
                <Select.Item value="fixed">Fixed Amount</Select.Item>
                <Select.Item value="code">Promotion Code</Select.Item>
              </Select.Content>
            </Select>
          </div>

          {discountType === "code" ? (
            <div>
              <Label htmlFor="promotion-code" className="mb-2">
                Promotion Code
              </Label>
              <Input
                id="promotion-code"
                placeholder="Enter promotion code"
                value={promotionCode}
                onChange={(e) => setPromotionCode(e.target.value)}
              />
            </div>
          ) : (
            <div>
              <Label htmlFor="discount-value" className="mb-2">
                {discountType === "percentage"
                  ? "Discount Percentage"
                  : `Discount Amount (${currency})`}
              </Label>
              <Input
                id="discount-value"
                type="number"
                step={discountType === "percentage" ? "1" : "0.01"}
                min="0"
                max={discountType === "percentage" ? "100" : undefined}
                placeholder={
                  discountType === "percentage"
                    ? "Enter percentage (e.g., 10 for 10%)"
                    : "Enter amount"
                }
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
              />
              {discountType === "percentage" && discountValue && parseFloat(discountValue) <= 100 && (
                <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                  Discount amount: {((orderTotal * parseFloat(discountValue)) / 100).toFixed(2)} {currency}
                </Text>
              )}
              {discountType === "percentage" && discountValue && parseFloat(discountValue) > 100 && (
                <Text size="xsmall" className="text-red-500 mt-1">
                  Discount cannot exceed 100%
                </Text>
              )}
              {discountType === "fixed" && discountValue && parseFloat(discountValue) > orderTotal && (
                <Text size="xsmall" className="text-red-500 mt-1">
                  Discount exceeds order total
                </Text>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="reason" className="mb-2">
              Reason (Optional)
            </Label>
            <Textarea
              id="reason"
              placeholder="e.g., Customer complaint, Price match, etc."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>

          <div className="bg-ui-bg-subtle rounded-lg p-4">
            <Text size="small" className="text-ui-fg-subtle mb-1">
              Current Order Total
            </Text>
            <Text size="large" className="font-semibold">
              {orderTotal.toFixed(2)} {currency}
            </Text>
            {discountValue && discountType !== "code" && (
              <>
                <Text size="small" className="text-ui-fg-subtle mt-2 mb-1">
                  New Total (After Discount)
                </Text>
                <Text size="large" className="font-semibold text-ui-fg-interactive">
                  {discountType === "percentage"
                    ? (orderTotal - (orderTotal * parseFloat(discountValue)) / 100).toFixed(2)
                    : (orderTotal - parseFloat(discountValue)).toFixed(2)}{" "}
                  {currency}
                </Text>
              </>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setIsOpen(false)
                setDiscountValue("")
                setPromotionCode("")
                setReason("")
              }}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={applyDiscount}
              disabled={isLoading || (!discountValue && !promotionCode)}
              isLoading={isLoading}
            >
              Apply Discount
            </Button>
          </div>
        </div>
      )}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.side.before",
})

export default OrderApplyDiscountWidget


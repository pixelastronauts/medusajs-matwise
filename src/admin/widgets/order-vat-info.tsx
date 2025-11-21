import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Badge, Copy } from "@medusajs/ui"
import { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types"

const OrderVatInfoWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const vatNumber = order?.metadata?.vat_number as string | undefined
  const isCompanyCheckout = order?.metadata?.is_company_checkout === true
  const shouldCalculateTax = order?.metadata?.should_calculate_tax !== false
  const vatValidated = order?.metadata?.vat_validated === true

  // Don't render if no VAT info
  if (!vatNumber && !isCompanyCheckout) {
    return null
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Heading level="h2">VAT Information</Heading>
            {isCompanyCheckout && (
              <Badge size="small" color="blue">
                Company Order
              </Badge>
            )}
            {vatValidated && (
              <Badge size="small" color="green">
                Validated
              </Badge>
            )}
          </div>
          
          {vatNumber && (
            <div className="mt-3 space-y-3">
              <div>
                <Text size="xsmall" className="text-ui-fg-subtle uppercase font-medium mb-1">
                  VAT Number
                </Text>
                <div className="flex items-center gap-2">
                  <Text size="base" className="text-ui-fg-base font-mono">
                    {vatNumber}
                  </Text>
                  <Copy content={vatNumber} className="text-ui-fg-muted" />
                </div>
              </div>
              
              <div>
                <Text size="xsmall" className="text-ui-fg-subtle uppercase font-medium mb-1">
                  Tax Calculation
                </Text>
                <div className="flex items-center gap-2">
                  {shouldCalculateTax ? (
                    <Badge size="small" color="orange">
                      Tax Applied
                    </Badge>
                  ) : (
                    <Badge size="small" color="grey">
                      Reverse Charge (No Tax)
                    </Badge>
                  )}
                </div>
                {!shouldCalculateTax && (
                  <Text size="xsmall" className="text-ui-fg-muted mt-1">
                    EU B2B - Customer pays VAT in their country
                  </Text>
                )}
              </div>

              {order.billing_address?.company && (
                <div>
                  <Text size="xsmall" className="text-ui-fg-subtle uppercase font-medium mb-1">
                    Company Name
                  </Text>
                  <Text size="base" className="text-ui-fg-base">
                    {order.billing_address.company}
                  </Text>
                </div>
              )}
            </div>
          )}
          
          {!vatNumber && isCompanyCheckout && (
            <Text size="small" className="text-ui-fg-muted mt-2">
              Company order without VAT number
            </Text>
          )}
        </div>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.side.after",
})

export default OrderVatInfoWidget


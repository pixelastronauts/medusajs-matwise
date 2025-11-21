import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Badge } from "@medusajs/ui"
import { DetailWidgetProps } from "@medusajs/framework/types"

const CustomerVatInfoWidget = ({ data: customer }: DetailWidgetProps<any>) => {
  const vatNumber = customer?.metadata?.vat_number as string | undefined
  const isCompany = customer?.metadata?.is_company === true
  const lastVatUpdate = customer?.metadata?.last_vat_update as string | undefined

  // Don't render if no VAT info
  if (!vatNumber && !isCompany) {
    return null
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Heading level="h2">VAT Information</Heading>
            {isCompany && (
              <Badge size="small" color="blue">
                Company
              </Badge>
            )}
          </div>
          
          {vatNumber && (
            <div className="mt-3 space-y-2">
              <div>
                <Text size="xsmall" className="text-ui-fg-subtle uppercase font-medium">
                  VAT Number
                </Text>
                <Text size="base" className="text-ui-fg-base font-mono">
                  {vatNumber}
                </Text>
              </div>
              
              {lastVatUpdate && (
                <div>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    Last updated: {new Date(lastVatUpdate).toLocaleDateString()}
                  </Text>
                </div>
              )}
            </div>
          )}
          
          {!vatNumber && isCompany && (
            <Text size="small" className="text-ui-fg-muted mt-2">
              Company customer without VAT number
            </Text>
          )}
        </div>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "customer.details.side.after",
})

export default CustomerVatInfoWidget


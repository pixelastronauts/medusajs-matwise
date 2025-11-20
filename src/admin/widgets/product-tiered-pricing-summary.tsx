import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Button, Badge, Text } from "@medusajs/ui"
import { useNavigate } from "react-router-dom"

// Widget that appears on the variant detail page
const VariantTieredPricingWidget = ({ data }: { data: any }) => {
  const navigate = useNavigate()
  const variant = data

  // Return null if no variant data
  if (!variant || !variant.id || !variant.product_id) {
    return null
  }

  // Check if variant has volume pricing tiers in metadata
  const volumePricingTiers = Array.isArray(variant?.metadata?.volume_pricing_tiers) 
    ? variant.metadata.volume_pricing_tiers 
    : []
  const hasTieredPricing = volumePricingTiers.length > 0

  const tierCount = volumePricingTiers.length

  const handleManagePricing = () => {
    navigate(`/products/${variant.product_id}/variants/${variant.id}/tiered-pricing`)
  }

  return (
    <Container className="p-4">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            <Heading level="h2" className="text-base">
              Volume Pricing
            </Heading>
            {hasTieredPricing && (
              <Badge color="blue" size="small">
                {tierCount} tier{tierCount !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <Text className="text-sm text-gray-600">
            {hasTieredPricing
              ? "This variant has volume-based pricing. Customers get automatic discounts for bulk orders."
              : "Set up volume discounts to encourage bulk purchases and increase order sizes."}
          </Text>
        </div>
        <Button size="small" variant="secondary" onClick={handleManagePricing}>
          {hasTieredPricing ? "Edit Tiers" : "Set Up Pricing"}
        </Button>
      </div>

      {hasTieredPricing && (
        <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <Text className="text-xs font-semibold text-gray-700 uppercase">
            Volume Pricing (€/m²):
          </Text>
          {volumePricingTiers
            .sort((a: any, b: any) => a.minQty - b.minQty)
            .map((tier: any, index: number) => {
              const basePricePerSqm = volumePricingTiers[0]?.pricePerSqm || 0
              const discountPercent = basePricePerSqm > 0 
                ? Math.round((1 - tier.pricePerSqm / basePricePerSqm) * 100)
                : 0

              return (
                <div
                  key={index}
                  className="flex items-center justify-between rounded bg-white px-3 py-2 text-sm"
                >
                  <span className="text-gray-600">
                    {tier.minQty}-{tier.maxQty || "∞"} items
                  </span>
                  <div className="flex items-center gap-2">
                    {discountPercent > 0 && (
                      <Badge color="green" size="small">
                        -{discountPercent}%
                      </Badge>
                    )}
                    <span className="font-semibold">
                      €{tier.pricePerSqm.toFixed(2)}/m²
                    </span>
                  </div>
                </div>
              )
            })}
          <Text className="mt-2 text-xs italic text-gray-500">
            Final price = €/m² × doormat size
          </Text>
        </div>
      )}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product_variant.details.after",
})

export default VariantTieredPricingWidget


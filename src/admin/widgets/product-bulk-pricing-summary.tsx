import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Badge, Text, Button } from "@medusajs/ui"
import { useEffect, useState } from "react"

// Widget that appears on the product detail page showing volume pricing summary
const ProductBulkPricingSummaryWidget = ({ data }: { data: any }) => {
  const product = data
  const [tiersCount, setTiersCount] = useState<number>(0)
  const [priceListsCount, setPriceListsCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!product?.id) return

    const fetchPricingData = async () => {
      try {
        // Get variant IDs
        const variantIds = product.variants?.map((v: any) => v.id).join(",") || ""
        
        if (!variantIds) {
          setLoading(false)
          return
        }

        // Fetch tiers for all variants
        const tiersResponse = await fetch(
          `/admin/volume-pricing/tiers?variant_ids=${variantIds}`,
          {
            credentials: "include",
            headers: { "Content-Type": "application/json" },
          }
        )

        if (tiersResponse.ok) {
          const tiersData = await tiersResponse.json()
          setTiersCount(tiersData.tiers?.length || 0)
        }

        // Fetch price lists
        const priceListsResponse = await fetch(`/admin/volume-pricing/price-lists`, {
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        })

        if (priceListsResponse.ok) {
          const priceListsData = await priceListsResponse.json()
          setPriceListsCount(priceListsData.price_lists?.length || 0)
        }
      } catch (err) {
        console.error("Error fetching pricing data:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchPricingData()
  }, [product?.id, product?.variants])

  // Return null if no product data
  if (!product || !product.id) {
    return null
  }

  const variantCount = product.variants?.length || 0
  const pricingUrl = `/app/products/${product.id}/bulk-pricing`

  return (
    <Container className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            <Heading level="h2" className="text-base">
              Volume Pricing
            </Heading>
            {!loading && tiersCount > 0 && (
              <Badge color="blue" size="small">
                {tiersCount} tier{tiersCount !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <Text className="text-sm text-gray-600">
            {loading
              ? "Loading pricing data..."
              : tiersCount > 0
              ? `Quantity-based pricing configured for ${variantCount} variant${
                  variantCount !== 1 ? "s" : ""
                }. ${priceListsCount > 0 ? `${priceListsCount} price list${priceListsCount !== 1 ? "s" : ""} available.` : ""}`
              : "Set up volume discounts to encourage bulk purchases across all variants at once."}
          </Text>
        </div>
        <a href={pricingUrl}>
          <Button size="small">
            {tiersCount > 0 ? "Edit Bulk Pricing" : "Set Up Pricing"}
          </Button>
        </a>
      </div>

      {!loading && tiersCount > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <Text className="text-2xl font-bold text-gray-900">{variantCount}</Text>
            <Text className="text-xs text-gray-500">Variants</Text>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <Text className="text-2xl font-bold text-gray-900">{tiersCount}</Text>
            <Text className="text-xs text-gray-500">Total Tiers</Text>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <Text className="text-2xl font-bold text-gray-900">{priceListsCount}</Text>
            <Text className="text-xs text-gray-500">Price Lists</Text>
          </div>
        </div>
      )}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default ProductBulkPricingSummaryWidget








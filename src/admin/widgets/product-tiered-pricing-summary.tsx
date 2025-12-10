import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Badge, Text, Select } from "@medusajs/ui"
import { useState, useEffect } from "react"

type VolumePriceTier = {
  id: string
  min_quantity: number
  max_quantity: number | null
  price_per_sqm: number
  price_per_sqm_display: number
}

type VolumePriceList = {
  id: string
  name: string
  description?: string
  type: "default" | "customer_group" | "sale"
  status: "active" | "draft"
  priority: number
  customer_group_ids?: string[]
  customer_ids?: string[]
  starts_at?: string
  ends_at?: string
  tiers: VolumePriceTier[]
}

// Widget that appears on the variant detail page
const VariantTieredPricingWidget = ({ data }: { data: any }) => {
  const variant = data

  const [priceLists, setPriceLists] = useState<VolumePriceList[]>([])
  const [activePriceList, setActivePriceList] = useState<VolumePriceList | null>(null)
  const [selectedPriceListId, setSelectedPriceListId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Return null if no variant data
  if (!variant || !variant.id || !variant.product_id) {
    return null
  }

  // Fetch price lists for this variant
  useEffect(() => {
    const fetchPriceLists = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/admin/volume-pricing/variants/${variant.id}`, {
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        })

        if (response.ok) {
          const data = await response.json()
          setPriceLists(data.price_lists || [])
          setActivePriceList(data.active_price_list || null)
          setSelectedPriceListId(data.active_price_list_id || (data.price_lists?.[0]?.id || null))
        }
      } catch (error) {
        console.error("Failed to fetch price lists:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchPriceLists()
  }, [variant.id])

  // Get the currently selected price list
  const displayedPriceList = priceLists.find(pl => pl.id === selectedPriceListId) || activePriceList || priceLists[0]
  const tiers = displayedPriceList?.tiers || []
  const hasTieredPricing = tiers.length > 0 || priceLists.length > 0

  const pricingUrl = `/app/volume-pricing`

  // Get type badge color
  const getTypeColor = (type: string) => {
    switch (type) {
      case "default": return "blue"
      case "customer_group": return "purple"
      case "sale": return "green"
      default: return "grey"
    }
  }

  // Get status badge color  
  const getStatusColor = (status: string) => {
    return status === "active" ? "green" : "grey"
  }

  if (loading) {
    return (
      <Container className="p-4">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
          <Text className="text-sm text-gray-500">Loading volume pricing...</Text>
        </div>
      </Container>
    )
  }

  return (
    <Container className="p-4">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            <Heading level="h2" className="text-base">
              Volume Pricing
            </Heading>
            {hasTieredPricing && tiers.length > 0 && (
              <Badge color="blue" size="small">
                {tiers.length} tier{tiers.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <Text className="text-sm text-gray-600">
            {hasTieredPricing
              ? "This variant has volume-based pricing. Customers get automatic discounts for bulk orders."
              : "Set up volume discounts to encourage bulk purchases and increase order sizes."}
          </Text>
        </div>
        <a href={pricingUrl}>
          <button 
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background border border-input hover:bg-accent hover:text-accent-foreground h-8 px-3"
          >
            {hasTieredPricing ? "Edit Tiers" : "Set Up Pricing"}
          </button>
        </a>
      </div>

      {/* Price List Selector */}
      {priceLists.length > 0 && (
        <div className="mb-3">
          <Text className="text-xs font-semibold text-gray-700 uppercase mb-2">
            Attached Price Lists ({priceLists.length})
          </Text>
          
          {priceLists.length > 1 ? (
            <select
              value={selectedPriceListId || ""}
              onChange={(e) => setSelectedPriceListId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-white"
            >
              {priceLists.map((pl) => (
                <option key={pl.id} value={pl.id}>
                  {pl.name} 
                  {pl.id === activePriceList?.id ? " ★ (Active Default)" : ""}
                  {pl.status === "draft" ? " (Draft)" : ""}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-md">
              <Text className="text-sm font-medium">{priceLists[0]?.name}</Text>
              {priceLists[0]?.id === activePriceList?.id && (
                <Badge color="green" size="small">Active</Badge>
              )}
            </div>
          )}
        </div>
      )}

      {/* Selected Price List Info */}
      {displayedPriceList && (
        <div className="mb-3 p-2 bg-gray-50 rounded border border-gray-100">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge color={getTypeColor(displayedPriceList.type)} size="small">
              {displayedPriceList.type === "customer_group" ? "Customer Group" : displayedPriceList.type}
            </Badge>
            <Badge color={getStatusColor(displayedPriceList.status)} size="small">
              {displayedPriceList.status}
            </Badge>
            {displayedPriceList.priority > 0 && (
              <Badge color="grey" size="small">
                Priority: {displayedPriceList.priority}
              </Badge>
            )}
            {displayedPriceList.customer_group_ids && displayedPriceList.customer_group_ids.length > 0 && (
              <Badge color="orange" size="small">
                {displayedPriceList.customer_group_ids.length} group{displayedPriceList.customer_group_ids.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          {displayedPriceList.description && (
            <Text className="text-xs text-gray-500 mt-1">{displayedPriceList.description}</Text>
          )}
        </div>
      )}

      {/* Tiers Display */}
      {tiers.length > 0 && (
        <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <Text className="text-xs font-semibold text-gray-700 uppercase">
            Volume Pricing (€/m²):
          </Text>
          {tiers.map((tier, index) => {
            const basePricePerSqm = tiers[0]?.price_per_sqm_display || 0
            const discountPercent = basePricePerSqm > 0 
              ? Math.round((1 - tier.price_per_sqm_display / basePricePerSqm) * 100)
              : 0

            return (
              <div
                key={tier.id || index}
                className="flex items-center justify-between rounded bg-white px-3 py-2 text-sm"
              >
                <span className="text-gray-600">
                  {tier.min_quantity}-{tier.max_quantity || "∞"} items
                </span>
                <div className="flex items-center gap-2">
                  {discountPercent > 0 && (
                    <Badge color="green" size="small">
                      -{discountPercent}%
                    </Badge>
                  )}
                  <span className="font-semibold">
                    €{(tier.price_per_sqm_display || 0).toFixed(2)}/m²
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

      {/* No tiers message */}
      {priceLists.length > 0 && tiers.length === 0 && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <Text className="text-sm text-yellow-700">
            This price list has no tiers defined yet.
          </Text>
        </div>
      )}

      {/* No price lists */}
      {priceLists.length === 0 && (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
          <Text className="text-sm text-gray-600">
            No volume price lists attached to this variant.
          </Text>
          <a 
            href={pricingUrl}
            className="text-xs text-blue-600 hover:underline mt-1 inline-block"
          >
            Go to Volume Pricing to attach a price list →
          </a>
        </div>
      )}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product_variant.details.after",
})

export default VariantTieredPricingWidget

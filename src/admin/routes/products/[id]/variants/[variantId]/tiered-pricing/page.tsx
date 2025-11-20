import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Button, Input, Table, Badge, Text } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"

type VolumePricingTier = {
  minQty: number
  maxQty: number | null
  pricePerSqm: number
}

const TieredPricingPage = () => {
  const { id: productId, variantId } = useParams()
  const navigate = useNavigate()
  
  const [variant, setVariant] = useState<any>(null)
  const [pricingTiers, setPricingTiers] = useState<VolumePricingTier[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetchVariantAndPrices()
  }, [variantId])

  const fetchVariantAndPrices = async () => {
    try {
      setLoading(true)
      
      // Fetch product with variants (including metadata)
      const variantResponse = await fetch(`/admin/products/${productId}?fields=*variants,*variants.metadata`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })
      
      if (!variantResponse.ok) {
        throw new Error(`Failed to fetch product: ${variantResponse.statusText}`)
      }
      
      const productData = await variantResponse.json()
      const variantData = productData.product?.variants?.find((v: any) => v.id === variantId)
      
      if (!variantData) {
        throw new Error("Variant not found in product")
      }
      
      setVariant(variantData)
      
      // Load volume pricing tiers from variant metadata
      const volumeTiers = variantData.metadata?.volume_pricing_tiers
      
      if (volumeTiers && Array.isArray(volumeTiers) && volumeTiers.length > 0) {
        setPricingTiers(volumeTiers)
      } else {
        // Default tiers (Standard material pricing as fallback)
        setPricingTiers([
          { minQty: 1, maxQty: 4, pricePerSqm: 120.0 },
          { minQty: 5, maxQty: 19, pricePerSqm: 100.0 },
          { minQty: 20, maxQty: null, pricePerSqm: 80.0 },
        ])
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const addTier = () => {
    const lastTier = pricingTiers[pricingTiers.length - 1]
    const newMinQty = lastTier.maxQty ? lastTier.maxQty + 1 : 1
    
    setPricingTiers([
      ...pricingTiers,
      {
        minQty: newMinQty,
        maxQty: null,
        pricePerSqm: lastTier.pricePerSqm * 0.9, // 10% discount from previous tier
      },
    ])
  }

  const removeTier = (index: number) => {
    if (pricingTiers.length <= 1) {
      setError("Must have at least one price tier")
      return
    }
    setPricingTiers(pricingTiers.filter((_, i) => i !== index))
  }

  const updateTier = (index: number, field: keyof VolumePricingTier, value: any) => {
    const newTiers = [...pricingTiers]
    newTiers[index] = {
      ...newTiers[index],
      [field]: value,
    }
    setPricingTiers(newTiers)
  }

  const savePrices = async () => {
    try {
      setSaving(true)
      setError(null)
      setSuccess(false)

      // Validate tiers
      for (let i = 0; i < pricingTiers.length; i++) {
        const tier = pricingTiers[i]
        if (tier.pricePerSqm <= 0) {
          throw new Error(`Tier ${i + 1}: Price per m² must be greater than 0`)
        }
        if (tier.minQty < 1) {
          throw new Error(`Tier ${i + 1}: Min quantity must be at least 1`)
        }
        if (tier.maxQty !== null && tier.maxQty < tier.minQty) {
          throw new Error(`Tier ${i + 1}: Max quantity must be greater than min quantity`)
        }
      }

      // Update variant metadata with volume pricing tiers
      const response = await fetch(`/admin/products/${productId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variants: [
            {
              id: variantId,
              metadata: {
                ...variant.metadata,
                volume_pricing_tiers: pricingTiers,
              },
            },
          ],
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to save pricing tiers")
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      await fetchVariantAndPrices() // Refresh data
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <Container className="p-4">Loading tiered pricing...</Container>
  }

  return (
    <Container className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <Heading level="h1" className="text-xl">
          Volume Pricing for {variant?.title}
        </Heading>
        <Button variant="secondary" onClick={() => navigate(`/products/${productId}/variants/${variantId}`)}>
          Back to Variant
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-lg bg-green-50 p-4 text-green-700">
          Prices updated successfully!
        </div>
      )}

      <div className="mb-4 rounded-lg bg-blue-50 p-4">
        <Text className="text-sm text-blue-900">
          <strong>How it works:</strong> Set price per square meter (€/m²) based on quantity ordered. 
          For example: 1-4 items at €120/m², 5-19 items at €100/m², 20+ items at €80/m².
          The final price is calculated as: price per m² × doormat size. Customers automatically get the best price based on their cart quantity.
        </Text>
      </div>

      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Min Quantity</Table.HeaderCell>
            <Table.HeaderCell>Max Quantity</Table.HeaderCell>
            <Table.HeaderCell>Price per m²</Table.HeaderCell>
            <Table.HeaderCell>Discount</Table.HeaderCell>
            <Table.HeaderCell>Actions</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {pricingTiers.map((tier, index) => {
            const basePricePerSqm = pricingTiers[0].pricePerSqm
            const discountPercent = basePricePerSqm > 0 
              ? Math.round((1 - tier.pricePerSqm / basePricePerSqm) * 100)
              : 0

            return (
              <Table.Row key={index}>
                <Table.Cell>
                  <Input
                    type="number"
                    min="1"
                    value={tier.minQty}
                    onChange={(e) => updateTier(index, "minQty", parseInt(e.target.value))}
                    className="w-24"
                  />
                </Table.Cell>
                <Table.Cell>
                  <Input
                    type="number"
                    min={tier.minQty}
                    value={tier.maxQty || ""}
                    placeholder="∞"
                    onChange={(e) => updateTier(index, "maxQty", e.target.value ? parseInt(e.target.value) : null)}
                    className="w-24"
                  />
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">€</span>
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      value={tier.pricePerSqm}
                      onChange={(e) => updateTier(index, "pricePerSqm", parseFloat(e.target.value))}
                      className="w-28"
                    />
                    <span className="text-gray-500">/m²</span>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  {discountPercent > 0 ? (
                    <Badge color="green">-{discountPercent}%</Badge>
                  ) : (
                    <Badge color="grey">Base price</Badge>
                  )}
                </Table.Cell>
                <Table.Cell>
                  <Button
                    variant="transparent"
                    onClick={() => removeTier(index)}
                    disabled={pricingTiers.length <= 1}
                  >
                    Remove
                  </Button>
                </Table.Cell>
              </Table.Row>
            )
          })}
        </Table.Body>
      </Table>

      <div className="mt-4 flex items-center gap-3">
        <Button variant="secondary" onClick={addTier}>
          + Add Tier
        </Button>
        <Button onClick={savePrices} disabled={saving}>
          {saving ? "Saving..." : "Save Prices"}
        </Button>
      </div>

      <div className="mt-6 rounded-lg bg-gray-50 p-4">
        <Heading level="h3" className="mb-3 text-sm">
          Preview: How customers see it
        </Heading>
        <Text className="mb-3 text-xs text-gray-600">
          Example for a 100×100cm (1 m²) doormat:
        </Text>
        <div className="space-y-2">
          {pricingTiers.map((tier, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <span className="text-gray-700">
                Order {tier.minQty}-{tier.maxQty || "∞"} items:
              </span>
              <span className="font-semibold text-gray-900">
                €{tier.pricePerSqm.toFixed(2)}/m² = €{tier.pricePerSqm.toFixed(2)} each
              </span>
            </div>
          ))}
        </div>
        <Text className="mt-3 text-xs italic text-gray-500">
          * Final price = €/m² × doormat size + customization fees (logo €15, text €5)
        </Text>
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  path: "/products/:id/variants/:variantId/tiered-pricing",
  name: "Volume Pricing",
})

export default TieredPricingPage


import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Container,
  Heading,
  Button,
  Input,
  Table,
  Badge,
  Text,
  Select,
  Toaster,
  toast,
} from "@medusajs/ui"
import { useEffect, useState, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"

type VolumePricingTier = {
  id?: string
  min_quantity: number
  max_quantity: number | null
  price_per_sqm: number // in euros
}

type VariantTiers = {
  variant_id: string
  variant_title: string
  tiers: VolumePricingTier[]
  hasChanges: boolean
}

type PriceList = {
  id: string
  name: string
  status: "active" | "draft"
  customer_group_ids: string[]
}

const BulkPricingPage = () => {
  const { id: productId } = useParams()
  const navigate = useNavigate()

  const [product, setProduct] = useState<any>(null)
  const [variantTiers, setVariantTiers] = useState<VariantTiers[]>([])
  const [priceLists, setPriceLists] = useState<PriceList[]>([])
  const [selectedPriceList, setSelectedPriceList] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expandedVariants, setExpandedVariants] = useState<Set<string>>(new Set())

  // Default tier template
  const defaultTiers: VolumePricingTier[] = [
    { min_quantity: 1, max_quantity: 4, price_per_sqm: 120 },
    { min_quantity: 5, max_quantity: 19, price_per_sqm: 100 },
    { min_quantity: 20, max_quantity: null, price_per_sqm: 80 },
  ]

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)

      // Fetch product with variants
      const productResponse = await fetch(
        `/admin/products/${productId}?fields=*variants,*variants.metadata`,
        {
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        }
      )

      if (!productResponse.ok) throw new Error("Failed to fetch product")

      const productData = await productResponse.json()
      setProduct(productData.product)

      // Fetch price lists
      const priceListsResponse = await fetch(`/admin/volume-pricing/price-lists`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })

      if (priceListsResponse.ok) {
        const priceListsData = await priceListsResponse.json()
        setPriceLists(priceListsData.price_lists || [])
      }

      // Fetch existing tiers for all variants
      const variantIds = productData.product?.variants?.map((v: any) => v.id).join(",")
      const priceListParam = selectedPriceList ? selectedPriceList : "null"

      const tiersResponse = await fetch(
        `/admin/volume-pricing/tiers?variant_ids=${variantIds}&price_list_id=${priceListParam}`,
        {
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        }
      )

      let existingTiers: any[] = []
      if (tiersResponse.ok) {
        const tiersData = await tiersResponse.json()
        existingTiers = tiersData.tiers || []
      }

      // Map variants to their tiers
      const mappedVariants: VariantTiers[] = (productData.product?.variants || []).map(
        (variant: any) => {
          const variantTiers = existingTiers
            .filter((t: any) => t.variant_id === variant.id)
            .map((t: any) => ({
              id: t.id,
              min_quantity: t.min_quantity,
              max_quantity: t.max_quantity,
              price_per_sqm: t.price_per_sqm_display || Number(t.price_per_sqm) / 100,
            }))

          // If no tiers in new module, check metadata (for migration)
          if (variantTiers.length === 0 && variant.metadata?.volume_pricing_tiers) {
            const metadataTiers = variant.metadata.volume_pricing_tiers as any[]
            return {
              variant_id: variant.id,
              variant_title: variant.title,
              tiers: metadataTiers.map((t: any) => ({
                min_quantity: t.minQty,
                max_quantity: t.maxQty,
                price_per_sqm: t.pricePerSqm,
              })),
              hasChanges: false,
            }
          }

          return {
            variant_id: variant.id,
            variant_title: variant.title,
            tiers: variantTiers.length > 0 ? variantTiers : [...defaultTiers],
            hasChanges: false,
          }
        }
      )

      setVariantTiers(mappedVariants)
      
      // Expand first variant by default
      if (mappedVariants.length > 0) {
        setExpandedVariants(new Set([mappedVariants[0].variant_id]))
      }
    } catch (err: any) {
      toast.error("Error", { description: err.message })
    } finally {
      setLoading(false)
    }
  }, [productId, selectedPriceList])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const toggleExpand = (variantId: string) => {
    setExpandedVariants((prev) => {
      const next = new Set(prev)
      if (next.has(variantId)) {
        next.delete(variantId)
      } else {
        next.add(variantId)
      }
      return next
    })
  }

  const expandAll = () => {
    setExpandedVariants(new Set(variantTiers.map((v) => v.variant_id)))
  }

  const collapseAll = () => {
    setExpandedVariants(new Set())
  }

  const updateTier = (
    variantId: string,
    tierIndex: number,
    field: keyof VolumePricingTier,
    value: any
  ) => {
    setVariantTiers((prev) =>
      prev.map((vt) => {
        if (vt.variant_id !== variantId) return vt

        const newTiers = [...vt.tiers]
        newTiers[tierIndex] = {
          ...newTiers[tierIndex],
          [field]: value,
        }

        return {
          ...vt,
          tiers: newTiers,
          hasChanges: true,
        }
      })
    )
  }

  const addTier = (variantId: string) => {
    setVariantTiers((prev) =>
      prev.map((vt) => {
        if (vt.variant_id !== variantId) return vt

        const lastTier = vt.tiers[vt.tiers.length - 1]
        const newMinQty = lastTier?.max_quantity ? lastTier.max_quantity + 1 : 1

        return {
          ...vt,
          tiers: [
            ...vt.tiers,
            {
              min_quantity: newMinQty,
              max_quantity: null,
              price_per_sqm: lastTier ? lastTier.price_per_sqm * 0.9 : 80,
            },
          ],
          hasChanges: true,
        }
      })
    )
  }

  const removeTier = (variantId: string, tierIndex: number) => {
    setVariantTiers((prev) =>
      prev.map((vt) => {
        if (vt.variant_id !== variantId) return vt
        if (vt.tiers.length <= 1) return vt

        return {
          ...vt,
          tiers: vt.tiers.filter((_, i) => i !== tierIndex),
          hasChanges: true,
        }
      })
    )
  }

  const applyTiersToAll = (sourceVariantId: string) => {
    const sourceVariant = variantTiers.find((v) => v.variant_id === sourceVariantId)
    if (!sourceVariant) return

    setVariantTiers((prev) =>
      prev.map((vt) => ({
        ...vt,
        tiers: sourceVariant.tiers.map((t) => ({ ...t, id: undefined })),
        hasChanges: true,
      }))
    )

    toast.success("Applied", { description: "Tiers applied to all variants" })
  }

  const saveAllChanges = async () => {
    const changedVariants = variantTiers.filter((vt) => vt.hasChanges)
    
    if (changedVariants.length === 0) {
      toast.info("No changes", { description: "No changes to save" })
      return
    }

    try {
      setSaving(true)

      const response = await fetch(`/admin/volume-pricing/tiers/bulk`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: changedVariants.map((vt) => ({
            variant_id: vt.variant_id,
            tiers: vt.tiers.map((t) => ({
              min_quantity: t.min_quantity,
              max_quantity: t.max_quantity,
              price_per_sqm: t.price_per_sqm,
            })),
          })),
          price_list_id: selectedPriceList,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to save")
      }

      toast.success("Saved", {
        description: `Updated pricing for ${changedVariants.length} variant(s)`,
      })

      // Refresh data
      await fetchData()
    } catch (err: any) {
      toast.error("Error", { description: err.message })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Container className="p-6">
        <div className="flex items-center justify-center py-12">
          <Text>Loading pricing data...</Text>
        </div>
      </Container>
    )
  }

  const hasAnyChanges = variantTiers.some((vt) => vt.hasChanges)

  return (
    <Container className="p-6">
      <Toaster />

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Heading level="h1" className="text-xl">
            Bulk Volume Pricing
          </Heading>
          <Text className="text-gray-600">
            {product?.title} - Edit pricing tiers for all variants at once
          </Text>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => navigate(`/app/products/${productId}`)}>
            Back to Product
          </Button>
          <Button onClick={saveAllChanges} disabled={saving || !hasAnyChanges}>
            {saving ? "Saving..." : `Save Changes${hasAnyChanges ? ` (${variantTiers.filter(v => v.hasChanges).length})` : ""}`}
          </Button>
        </div>
      </div>

      {/* Price List Selector */}
      <div className="mb-6 rounded-lg bg-gray-50 p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Text className="mb-2 text-sm font-medium">Price List</Text>
            <Select
              value={selectedPriceList || "default"}
              onValueChange={(value) => {
                setSelectedPriceList(value === "default" ? null : value)
              }}
            >
              <Select.Trigger>
                <Select.Value placeholder="Select price list" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="default">
                  Default Pricing (All Customers)
                </Select.Item>
                {priceLists.map((pl) => (
                  <Select.Item key={pl.id} value={pl.id}>
                    {pl.name}{" "}
                    <Badge size="small" color={pl.status === "active" ? "green" : "grey"}>
                      {pl.status}
                    </Badge>
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
          <div className="pt-6">
            <Button
              variant="secondary"
              size="small"
              onClick={() => navigate("/app/settings/volume-pricing/price-lists")}
            >
              Manage Price Lists
            </Button>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="mb-6 rounded-lg bg-blue-50 p-4">
        <Text className="text-sm text-blue-900">
          <strong>How it works:</strong> Set price per square meter (€/m²) based on quantity ordered.
          For example: 1-4 items at €120/m², 5-19 items at €100/m², 20+ items at €80/m².
          Customers automatically get the best price based on their cart quantity.
        </Text>
      </div>

      {/* Expand/Collapse Controls */}
      <div className="mb-4 flex items-center gap-2">
        <Button variant="transparent" size="small" onClick={expandAll}>
          Expand All
        </Button>
        <Button variant="transparent" size="small" onClick={collapseAll}>
          Collapse All
        </Button>
        <div className="ml-auto">
          <Text className="text-sm text-gray-500">
            {variantTiers.length} variant(s) •{" "}
            {variantTiers.filter((v) => v.hasChanges).length} with unsaved changes
          </Text>
        </div>
      </div>

      {/* Variants with Tiers */}
      <div className="space-y-4">
        {variantTiers.map((vt) => (
          <div
            key={vt.variant_id}
            className={`rounded-lg border ${
              vt.hasChanges ? "border-amber-300 bg-amber-50" : "border-gray-200 bg-white"
            }`}
          >
            {/* Variant Header */}
            <div
              className="flex cursor-pointer items-center justify-between p-4"
              onClick={() => toggleExpand(vt.variant_id)}
            >
              <div className="flex items-center gap-3">
                <span className="text-gray-400">
                  {expandedVariants.has(vt.variant_id) ? "▼" : "▶"}
                </span>
                <Text className="font-medium">{vt.variant_title}</Text>
                <Badge size="small" color="grey">
                  {vt.tiers.length} tier{vt.tiers.length !== 1 ? "s" : ""}
                </Badge>
                {vt.hasChanges && (
                  <Badge size="small" color="orange">
                    Unsaved
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Text className="text-sm text-gray-500">
                  €{vt.tiers[0]?.price_per_sqm?.toFixed(2) || "0.00"}/m² base
                </Text>
              </div>
            </div>

            {/* Expanded Content */}
            {expandedVariants.has(vt.variant_id) && (
              <div className="border-t border-gray-200 p-4">
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.HeaderCell className="w-32">Min Qty</Table.HeaderCell>
                      <Table.HeaderCell className="w-32">Max Qty</Table.HeaderCell>
                      <Table.HeaderCell className="w-40">Price per m²</Table.HeaderCell>
                      <Table.HeaderCell className="w-24">Discount</Table.HeaderCell>
                      <Table.HeaderCell className="w-24">Actions</Table.HeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {vt.tiers.map((tier, idx) => {
                      const basePricePerSqm = vt.tiers[0]?.price_per_sqm || 0
                      const discountPercent =
                        basePricePerSqm > 0
                          ? Math.round((1 - tier.price_per_sqm / basePricePerSqm) * 100)
                          : 0

                      return (
                        <Table.Row key={idx}>
                          <Table.Cell>
                            <Input
                              type="number"
                              min="1"
                              value={tier.min_quantity}
                              onChange={(e) =>
                                updateTier(
                                  vt.variant_id,
                                  idx,
                                  "min_quantity",
                                  parseInt(e.target.value) || 1
                                )
                              }
                              className="w-24"
                            />
                          </Table.Cell>
                          <Table.Cell>
                            <Input
                              type="number"
                              min={tier.min_quantity}
                              value={tier.max_quantity ?? ""}
                              placeholder="∞"
                              onChange={(e) =>
                                updateTier(
                                  vt.variant_id,
                                  idx,
                                  "max_quantity",
                                  e.target.value ? parseInt(e.target.value) : null
                                )
                              }
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
                                value={tier.price_per_sqm}
                                onChange={(e) =>
                                  updateTier(
                                    vt.variant_id,
                                    idx,
                                    "price_per_sqm",
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className="w-24"
                              />
                              <span className="text-gray-500">/m²</span>
                            </div>
                          </Table.Cell>
                          <Table.Cell>
                            {discountPercent > 0 ? (
                              <Badge color="green">-{discountPercent}%</Badge>
                            ) : (
                              <Badge color="grey">Base</Badge>
                            )}
                          </Table.Cell>
                          <Table.Cell>
                            <Button
                              variant="transparent"
                              size="small"
                              onClick={() => removeTier(vt.variant_id, idx)}
                              disabled={vt.tiers.length <= 1}
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
                  <Button variant="secondary" size="small" onClick={() => addTier(vt.variant_id)}>
                    + Add Tier
                  </Button>
                  <Button
                    variant="transparent"
                    size="small"
                    onClick={() => applyTiersToAll(vt.variant_id)}
                  >
                    Apply to All Variants
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Preview Section */}
      {variantTiers.length > 0 && expandedVariants.size > 0 && (
        <div className="mt-6 rounded-lg bg-gray-50 p-4">
          <Heading level="h3" className="mb-3 text-sm">
            Preview: How customers see it (1 m² doormat)
          </Heading>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {variantTiers
              .filter((vt) => expandedVariants.has(vt.variant_id))
              .map((vt) => (
                <div key={vt.variant_id} className="rounded border bg-white p-3">
                  <Text className="mb-2 text-sm font-medium">{vt.variant_title}</Text>
                  {vt.tiers.map((tier, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        {tier.min_quantity}-{tier.max_quantity || "∞"} items:
                      </span>
                      <span className="font-medium">€{tier.price_per_sqm.toFixed(2)}/m²</span>
                    </div>
                  ))}
                </div>
              ))}
          </div>
        </div>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Bulk Volume Pricing",
})

export default BulkPricingPage


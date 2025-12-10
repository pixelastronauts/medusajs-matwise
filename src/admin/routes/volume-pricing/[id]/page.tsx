import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Container,
  Heading,
  Button,
  Input,
  Badge,
  Text,
  Textarea,
  Select,
  toast,
  FocusModal,
  Label,
  Switch,
  Checkbox,
} from "@medusajs/ui"
import { useEffect, useState, useCallback } from "react"
import { useParams, useNavigate, useSearchParams } from "react-router-dom"

type Tier = {
  id?: string
  min_quantity: number
  max_quantity: number | null
  price_per_sqm: number
  requires_login?: boolean
}

type PriceList = {
  id: string
  name: string
  description: string | null
  type: "default" | "customer_group" | "sale"
  status: "active" | "draft"
  starts_at: string | null
  ends_at: string | null
  customer_group_ids: string[]
  customer_ids: string[]
  priority: number
  currency_code: string
  tiers?: Tier[]
}

type CustomerGroup = {
  id: string
  name: string
}

type Product = {
  id: string
  title: string
  variants: { id: string; title: string; metadata?: any }[]
}

type PricingFormula = {
  id: string
  name: string
  description?: string
  is_default?: boolean
}

const PRESET_SIZES = [
  { label: "40 × 60 cm", width: 40, height: 60 },
  { label: "50 × 70 cm", width: 50, height: 70 },
  { label: "60 × 90 cm", width: 60, height: 90 },
  { label: "70 × 100 cm", width: 70, height: 100 },
  { label: "Custom", width: 0, height: 0 },
]

const PriceListEditPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnTo = searchParams.get("returnTo") || "/volume-pricing"
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [priceList, setPriceList] = useState<PriceList | null>(null)
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [pricingFormulas, setPricingFormulas] = useState<PricingFormula[]>([])
  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([])
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())

  // Preview calculator state
  const [previewFormulaId, setPreviewFormulaId] = useState<string>("")
  const [previewSizeIndex, setPreviewSizeIndex] = useState(0)
  const [previewCustomWidth, setPreviewCustomWidth] = useState(100)
  const [previewCustomHeight, setPreviewCustomHeight] = useState(100)
  const [previewQuantity, setPreviewQuantity] = useState(1)
  const [previewResult, setPreviewResult] = useState<{
    price_per_sqm: number
    price_per_item: number
    total_price: number
    sqm: number
    tier_used: string
  } | null>(null)
  const [calculatingPreview, setCalculatingPreview] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "default" as "default" | "customer_group" | "sale",
    status: "draft" as "active" | "draft",
    starts_at: "",
    ends_at: "",
    customer_group_ids: [] as string[],
    priority: 0,
  })
  const [tiers, setTiers] = useState<Tier[]>([
    { min_quantity: 1, max_quantity: 4, price_per_sqm: 120, requires_login: false },
    { min_quantity: 5, max_quantity: 19, price_per_sqm: 100, requires_login: false },
    { min_quantity: 20, max_quantity: null, price_per_sqm: 80, requires_login: false },
  ])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)

      // Fetch price list details
      const [priceListRes, groupsRes, productsRes, formulasRes] = await Promise.all([
        fetch(`/admin/volume-pricing/price-lists/${id}`, {
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        }),
        fetch(`/admin/customer-groups?limit=1000`, {
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        }),
        fetch(`/admin/products?limit=100&fields=id,title,variants.id,variants.title,variants.metadata`, {
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        }),
        fetch(`/admin/pricing-formulas`, {
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        }),
      ])

      if (priceListRes.ok) {
        const data = await priceListRes.json()
        const pl = data.price_list
        setPriceList(pl)

        setFormData({
          name: pl.name || "",
          description: pl.description || "",
          type: pl.type || "default",
          status: pl.status || "draft",
          starts_at: pl.starts_at ? pl.starts_at.split("T")[0] : "",
          ends_at: pl.ends_at ? pl.ends_at.split("T")[0] : "",
          customer_group_ids: pl.customer_group_ids || [],
          priority: pl.priority || 0,
        })

        setTiers(
          pl.tiers?.map((t: any) => ({
            id: t.id,
            min_quantity: t.min_quantity,
            max_quantity: t.max_quantity,
            price_per_sqm: t.price_per_sqm_display || Number(t.price_per_sqm) / 100,
            requires_login: t.requires_login || false,
          })) || []
        )

        // Set linked variants from the response
        setSelectedVariantIds(data.variant_ids || [])
      }

      if (groupsRes.ok) {
        const data = await groupsRes.json()
        setCustomerGroups(data.customer_groups || [])
      }

      if (productsRes.ok) {
        const data = await productsRes.json()
        // Filter to only show base variants (exclude custom/child variants)
        const productsWithBaseVariants = (data.products || []).map((p: Product) => ({
          ...p,
          variants: p.variants.filter((v: any) => {
            const isCustomOrder = v.metadata?.is_custom_order === true
            const isCustom = v.metadata?.custom === true
            const hasBaseVariantId = !!v.metadata?.base_variant_id
            // Only include if NOT a custom variant
            return !isCustomOrder && !isCustom && !hasBaseVariantId
          }),
        })).filter((p: Product) => p.variants.length > 0)
        setProducts(productsWithBaseVariants)
      }

      if (formulasRes.ok) {
        const data = await formulasRes.json()
        setPricingFormulas(data.formulas || [])
        const defaultFormula = (data.formulas || []).find((f: PricingFormula) => f.is_default)
        if (defaultFormula) {
          setPreviewFormulaId(defaultFormula.id)
        }
      }
    } catch (err) {
      console.error("Error fetching data:", err)
      toast.error("Error", { description: "Failed to load price list" })
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Error", { description: "Name is required" })
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: formData.name,
        description: formData.description || null,
        type: formData.type,
        status: formData.status,
        starts_at: formData.starts_at || null,
        ends_at: formData.ends_at || null,
        customer_group_ids: formData.customer_group_ids,
        priority: formData.priority,
        tiers: tiers.map((t) => ({
          min_quantity: t.min_quantity,
          max_quantity: t.max_quantity,
          price_per_sqm: t.price_per_sqm,
          requires_login: t.requires_login || false,
        })),
        variant_ids: selectedVariantIds,
      }

      const response = await fetch(`/admin/volume-pricing/price-lists/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        // Clear price caches after successful save
        try {
          await fetch(`/admin/volume-pricing/clear-cache`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
          })
        } catch {
          // Cache clear failed, but save was successful - continue
        }
        
        toast.success("Saved", { description: "Price list updated successfully" })
        navigate(returnTo)
      } else {
        const error = await response.json()
        toast.error("Error", { description: error.message || "Failed to save" })
      }
    } catch (err: any) {
      toast.error("Error", { description: err.message || "Failed to save" })
    } finally {
      setSaving(false)
    }
  }

  const toggleCustomerGroup = (groupId: string) => {
    setFormData((prev) => ({
      ...prev,
      customer_group_ids: prev.customer_group_ids.includes(groupId)
        ? prev.customer_group_ids.filter((id) => id !== groupId)
        : [...prev.customer_group_ids, groupId],
    }))
  }

  const toggleVariant = (variantId: string) => {
    setSelectedVariantIds((prev) =>
      prev.includes(variantId) ? prev.filter((id) => id !== variantId) : [...prev, variantId]
    )
  }

  const toggleAllProductVariants = (product: Product) => {
    const productVariantIds = product.variants.map((v) => v.id)
    const allSelected = productVariantIds.every((id) => selectedVariantIds.includes(id))

    if (allSelected) {
      setSelectedVariantIds((prev) => prev.filter((id) => !productVariantIds.includes(id)))
    } else {
      setSelectedVariantIds((prev) => [...new Set([...prev, ...productVariantIds])])
    }
  }

  const toggleProductExpanded = (productId: string) => {
    setExpandedProducts((prev) => {
      const next = new Set(prev)
      if (next.has(productId)) {
        next.delete(productId)
      } else {
        next.add(productId)
      }
      return next
    })
  }

  const updateTier = (index: number, field: keyof Tier, value: any) => {
    const newTiers = [...tiers]
    newTiers[index] = { ...newTiers[index], [field]: value }
    setTiers(newTiers)
  }

  const addTier = () => {
    const lastTier = tiers[tiers.length - 1]
    const newMinQty = lastTier ? (lastTier.max_quantity || lastTier.min_quantity) + 1 : 1

    setTiers([
      ...tiers,
      {
        min_quantity: newMinQty,
        max_quantity: null,
        price_per_sqm: lastTier ? lastTier.price_per_sqm * 0.9 : 80,
        requires_login: false,
      },
    ])
  }

  const removeTier = (index: number) => {
    if (tiers.length <= 1) return
    setTiers(tiers.filter((_, i) => i !== index))
  }

  const calculatePreview = async () => {
    setCalculatingPreview(true)
    try {
      const size = PRESET_SIZES[previewSizeIndex]
      const width = size.width === 0 ? previewCustomWidth : size.width
      const height = size.height === 0 ? previewCustomHeight : size.height
      const sqm = (width * height) / 10000

      const sortedTiers = [...tiers].sort((a, b) => a.min_quantity - b.min_quantity)
      let applicableTier = sortedTiers[0]

      for (const tier of sortedTiers) {
        if (previewQuantity >= tier.min_quantity) {
          if (tier.max_quantity === null || previewQuantity <= tier.max_quantity) {
            applicableTier = tier
            break
          }
        }
      }

      const pricePerSqm = applicableTier?.price_per_sqm || 120
      let pricePerItem = pricePerSqm * sqm

      if (previewFormulaId) {
        const calcRes = await fetch(`/admin/pricing-formulas/${previewFormulaId}/calculate`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            variables: {
              width_value: width,
              length_value: height,
              price_per_sqm: pricePerSqm,
            },
          }),
        })

        if (calcRes.ok) {
          const calcData = await calcRes.json()
          pricePerItem = calcData.price || calcData.result || pricePerItem
        }
      }

      setPreviewResult({
        price_per_sqm: pricePerSqm,
        price_per_item: Math.round(pricePerItem * 100) / 100,
        total_price: Math.round(pricePerItem * previewQuantity * 100) / 100,
        sqm: Math.round(sqm * 10000) / 10000,
        tier_used: `${applicableTier?.min_quantity}-${applicableTier?.max_quantity || "∞"} qty`,
      })
    } catch (err: any) {
      toast.error("Error", { description: err.message })
    } finally {
      setCalculatingPreview(false)
    }
  }

  if (loading) {
    return (
      <Container className="flex items-center justify-center min-h-[400px]">
        <Text className="text-gray-500">Loading...</Text>
      </Container>
    )
  }

  return (
    <FocusModal open={true} onOpenChange={(open) => !open && navigate(returnTo)}>
      <FocusModal.Content className="max-h-[90vh] overflow-hidden">
        <FocusModal.Header>
          <Heading level="h2">Edit Price List</Heading>
        </FocusModal.Header>
        <FocusModal.Body className="overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Left Column - Settings */}
            <div className="space-y-6">
              <Heading level="h3" className="text-base">Settings</Heading>

              {/* Name */}
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Standard Pricing, B2B Pricing"
                />
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>

              {/* Type */}
              <div>
                <Label>Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, type: value as typeof formData.type })
                  }
                >
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="default">Default (for all customers)</Select.Item>
                    <Select.Item value="customer_group">Customer Group (specific groups)</Select.Item>
                    <Select.Item value="sale">Sale (temporary discount)</Select.Item>
                  </Select.Content>
                </Select>
              </div>

              {/* Customer Groups */}
              {formData.type === "customer_group" && (
                <div>
                  <Label>Customer Groups</Label>
                  <Text className="text-xs text-gray-500 mb-2">
                    Select which customer groups can access this pricing
                  </Text>
                  <div className="mt-2 max-h-40 overflow-y-auto rounded border border-gray-200">
                    {customerGroups.length === 0 ? (
                      <div className="p-3 text-sm text-gray-500">No customer groups found</div>
                    ) : (
                      customerGroups.map((group) => (
                        <div
                          key={group.id}
                          className={`flex cursor-pointer items-center gap-3 border-b border-gray-100 p-2 last:border-b-0 hover:bg-gray-50 ${
                            formData.customer_group_ids.includes(group.id) ? "bg-blue-50" : ""
                          }`}
                          onClick={() => toggleCustomerGroup(group.id)}
                        >
                          <Checkbox checked={formData.customer_group_ids.includes(group.id)} />
                          <span className="text-sm">{group.name}</span>
                        </div>
                      ))
                    )}
                  </div>
                  {formData.customer_group_ids.length > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <Badge color="purple" size="small">
                        {formData.customer_group_ids.length} group{formData.customer_group_ids.length !== 1 ? "s" : ""} selected
                      </Badge>
                      <Button
                        variant="transparent"
                        size="small"
                        onClick={() => setFormData({ ...formData, customer_group_ids: [] })}
                      >
                        Clear all
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Status & Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <Switch
                    id="status"
                    checked={formData.status === "active"}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, status: checked ? "active" : "draft" })
                    }
                  />
                  <Label htmlFor="status">Active</Label>
                </div>
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Input
                    id="priority"
                    type="number"
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="starts_at">Starts At</Label>
                  <Input
                    id="starts_at"
                    type="date"
                    value={formData.starts_at}
                    onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="ends_at">Ends At</Label>
                  <Input
                    id="ends_at"
                    type="date"
                    value={formData.ends_at}
                    onChange={(e) => setFormData({ ...formData, ends_at: e.target.value })}
                  />
                </div>
              </div>

              {/* Pricing Tiers */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Label>Pricing Tiers (€/m²)</Label>
                  <Button variant="secondary" size="small" onClick={addTier}>
                    + Add Tier
                  </Button>
                </div>
                <div className="space-y-2">
                  {tiers.map((tier, idx) => {
                    const basePricePerSqm = tiers[0]?.price_per_sqm || 0
                    const discountPercent =
                      basePricePerSqm > 0
                        ? Math.round((1 - tier.price_per_sqm / basePricePerSqm) * 100)
                        : 0

                    return (
                      <div key={idx} className="flex items-center gap-2 rounded border border-gray-200 bg-gray-50 p-2">
                        <Input
                          type="number"
                          min="1"
                          value={tier.min_quantity}
                          onChange={(e) => updateTier(idx, "min_quantity", parseInt(e.target.value) || 1)}
                          className="w-16"
                          placeholder="Min"
                        />
                        <span className="text-gray-400">-</span>
                        <Input
                          type="number"
                          value={tier.max_quantity ?? ""}
                          onChange={(e) =>
                            updateTier(idx, "max_quantity", e.target.value ? parseInt(e.target.value) : null)
                          }
                          className="w-16"
                          placeholder="∞"
                        />
                        <span className="text-gray-500">qty</span>
                        <span className="text-gray-400">=</span>
                        <span className="text-gray-500">€</span>
                        <Input
                          type="number"
                          step="1"
                          min="1"
                          value={tier.price_per_sqm}
                          onChange={(e) => updateTier(idx, "price_per_sqm", parseFloat(e.target.value) || 0)}
                          className="w-20"
                        />
                        <span className="text-gray-500">/m²</span>
                        {discountPercent > 0 && (
                          <Badge size="small" color="green">
                            -{discountPercent}%
                          </Badge>
                        )}
                        <div className="flex items-center gap-1 ml-2">
                          <input
                            type="checkbox"
                            id={`requires-login-${idx}`}
                            checked={tier.requires_login || false}
                            onChange={(e) => updateTier(idx, "requires_login", e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                          <label htmlFor={`requires-login-${idx}`} className="text-xs text-gray-500" title="Hidden for guests">
                            🔒
                          </label>
                        </div>
                        <Button
                          variant="transparent"
                          size="small"
                          onClick={() => removeTier(idx)}
                          disabled={tiers.length <= 1}
                        >
                          ×
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Price Preview Calculator */}
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <Heading level="h3" className="text-sm mb-3">Price Preview Calculator</Heading>

                <div className="mb-3">
                  <Label className="text-xs">Pricing Formula (optional)</Label>
                  <Select
                    value={previewFormulaId || "_none"}
                    onValueChange={(value) => setPreviewFormulaId(value === "_none" ? "" : value)}
                  >
                    <Select.Trigger>
                      <Select.Value placeholder="Select formula or use simple €/m²" />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="_none">No formula (simple €/m²)</Select.Item>
                      {pricingFormulas.map((f) => (
                        <Select.Item key={f.id} value={f.id}>
                          {f.name} {f.is_default ? "★" : ""}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div>
                    <Label className="text-xs">Size</Label>
                    <Select
                      value={previewSizeIndex.toString()}
                      onValueChange={(v) => setPreviewSizeIndex(parseInt(v))}
                    >
                      <Select.Trigger>
                        <Select.Value />
                      </Select.Trigger>
                      <Select.Content>
                        {PRESET_SIZES.map((s, i) => (
                          <Select.Item key={i} value={i.toString()}>
                            {s.label}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select>
                  </div>
                  {PRESET_SIZES[previewSizeIndex].width === 0 && (
                    <>
                      <div>
                        <Label className="text-xs">Width (cm)</Label>
                        <Input
                          type="number"
                          value={previewCustomWidth}
                          onChange={(e) => setPreviewCustomWidth(parseInt(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Height (cm)</Label>
                        <Input
                          type="number"
                          value={previewCustomHeight}
                          onChange={(e) => setPreviewCustomHeight(parseInt(e.target.value) || 0)}
                        />
                      </div>
                    </>
                  )}
                  <div>
                    <Label className="text-xs">Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      value={previewQuantity}
                      onChange={(e) => setPreviewQuantity(parseInt(e.target.value) || 1)}
                    />
                  </div>
                </div>

                <Button
                  variant="secondary"
                  size="small"
                  onClick={calculatePreview}
                  isLoading={calculatingPreview}
                  className="w-full"
                >
                  Calculate Preview
                </Button>

                {previewResult && (
                  <div className="mt-3 rounded bg-white p-3 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Text className="text-xs text-gray-500">Tier Used</Text>
                        <Text className="font-medium">{previewResult.tier_used}</Text>
                      </div>
                      <div>
                        <Text className="text-xs text-gray-500">€/m²</Text>
                        <Text className="font-medium">€{previewResult.price_per_sqm.toFixed(2)}</Text>
                      </div>
                      <div>
                        <Text className="text-xs text-gray-500">Per Item</Text>
                        <Text className="font-medium">€{previewResult.price_per_item.toFixed(2)}</Text>
                      </div>
                      <div>
                        <Text className="text-xs text-gray-500">Total ({previewQuantity}x)</Text>
                        <Text className="font-bold text-green-600">€{previewResult.total_price.toFixed(2)}</Text>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Variant Selection */}
            <div className="space-y-4">
              <Heading level="h3" className="text-base">Apply to Variants</Heading>
              <Text className="text-sm text-gray-500">
                Select which product variants this price list applies to
              </Text>

              <div className="max-h-[500px] overflow-y-auto rounded border border-gray-200">
                {products.map((product) => {
                  const productVariantIds = product.variants.map((v) => v.id)
                  const selectedCount = productVariantIds.filter((id) => selectedVariantIds.includes(id)).length
                  const allSelected = selectedCount === productVariantIds.length
                  const someSelected = selectedCount > 0 && !allSelected
                  const isExpanded = expandedProducts.has(product.id)

                  return (
                    <div key={product.id} className="border-b border-gray-100 last:border-b-0">
                      <div
                        className={`flex cursor-pointer items-center gap-3 p-3 hover:bg-gray-50 ${
                          someSelected || allSelected ? "bg-blue-50" : ""
                        }`}
                        onClick={() => toggleProductExpanded(product.id)}
                      >
                        <div onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={() => toggleAllProductVariants(product)}
                          />
                        </div>
                        <div className="flex-1">
                          <Text className="font-medium">{product.title}</Text>
                          <Text className="text-xs text-gray-500">
                            {selectedCount}/{productVariantIds.length} variants selected
                          </Text>
                        </div>
                        <span className="text-gray-400">{isExpanded ? "▼" : "▶"}</span>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-gray-100 bg-gray-50 pl-10">
                          {product.variants.map((variant) => (
                            <div
                              key={variant.id}
                              className={`flex cursor-pointer items-center gap-3 border-b border-gray-100 p-2 last:border-b-0 hover:bg-gray-100 ${
                                selectedVariantIds.includes(variant.id) ? "bg-blue-100" : ""
                              }`}
                              onClick={() => toggleVariant(variant.id)}
                            >
                              <Checkbox checked={selectedVariantIds.includes(variant.id)} />
                              <Text className="text-sm">{variant.title}</Text>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {selectedVariantIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <Badge color="blue" size="small">
                    {selectedVariantIds.length} variant{selectedVariantIds.length !== 1 ? "s" : ""} selected
                  </Badge>
                  <Button variant="transparent" size="small" onClick={() => setSelectedVariantIds([])}>
                    Clear all
                  </Button>
                </div>
              )}
            </div>
          </div>
        </FocusModal.Body>
        <FocusModal.Footer>
          <Button variant="secondary" onClick={() => navigate(returnTo)}>
            Cancel
          </Button>
          <Button onClick={handleSave} isLoading={saving}>
            Save Changes
          </Button>
        </FocusModal.Footer>
      </FocusModal.Content>
    </FocusModal>
  )
}

export const config = defineRouteConfig({
  label: "Edit Price List",
})

export default PriceListEditPage


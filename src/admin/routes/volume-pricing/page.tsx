import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Container,
  Heading,
  Button,
  Input,
  Table,
  Badge,
  Text,
  Textarea,
  Select,
  Toaster,
  toast,
  FocusModal,
  Label,
  Switch,
  Checkbox,
} from "@medusajs/ui"
import { CurrencyDollar, MagnifyingGlass } from "@medusajs/icons"
import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"

type Tier = {
  id?: string
  min_quantity: number
  max_quantity: number | null
  price_per_sqm: number // in euros for display
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
  created_at: string
  tier_count?: number
  variant_count?: number
  tiers?: Tier[]
}

type CustomerGroup = {
  id: string
  name: string
}

type Product = {
  id: string
  title: string
  variants: { id: string; title: string }[]
}

type PricingFormula = {
  id: string
  name: string
  description?: string
  is_default?: boolean
}

// Preset sizes for calculator
const PRESET_SIZES = [
  { label: "40 × 60 cm", width: 40, height: 60 },
  { label: "50 × 70 cm", width: 50, height: 70 },
  { label: "60 × 90 cm", width: 60, height: 90 },
  { label: "70 × 100 cm", width: 70, height: 100 },
  { label: "Custom", width: 0, height: 0 },
]

const VolumePricingPage = () => {
  const navigate = useNavigate()
  const [priceLists, setPriceLists] = useState<PriceList[]>([])
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [pricingFormulas, setPricingFormulas] = useState<PricingFormula[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingPriceList, setEditingPriceList] = useState<PriceList | null>(null)
  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([])
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())
  
  // Preview calculator state (in modal)
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

  // Full simulator state (main page)
  const [simCustomerGroupId, setSimCustomerGroupId] = useState<string>("")
  const [simProductId, setSimProductId] = useState<string>("")
  const [simVariantId, setSimVariantId] = useState<string>("")
  const [simWidth, setSimWidth] = useState(70)
  const [simHeight, setSimHeight] = useState(100)
  const [simQuantity, setSimQuantity] = useState(1)
  const [simResult, setSimResult] = useState<{
    price_per_item: number
    total_price: number
    price_per_sqm: number
    price_list_name: string | null
    sqm: number
  } | null>(null)
  const [simulatingPrice, setSimulatingPrice] = useState(false)

  // Filter state
  const [filterName, setFilterName] = useState("")
  const [filterType, setFilterType] = useState<string>("_all")
  const [filterStatus, setFilterStatus] = useState<string>("_all")
  const [filterCustomerGroup, setFilterCustomerGroup] = useState<string>("_all")

  // Drag and drop state
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

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
    { min_quantity: 1, max_quantity: 4, price_per_sqm: 120 },
    { min_quantity: 5, max_quantity: 19, price_per_sqm: 100 },
    { min_quantity: 20, max_quantity: null, price_per_sqm: 80 },
  ])
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)

      // Fetch price lists
      const response = await fetch(`/admin/volume-pricing/price-lists`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })

      if (response.ok) {
        const data = await response.json()
        // Sort by priority (highest first)
        const sortedLists = (data.price_lists || []).sort((a: PriceList, b: PriceList) => b.priority - a.priority)
        setPriceLists(sortedLists)
      }

      // Fetch customer groups
      const groupsResponse = await fetch(`/admin/customer-groups`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })

      if (groupsResponse.ok) {
        const groupsData = await groupsResponse.json()
        setCustomerGroups(groupsData.customer_groups || [])
      }

      // Fetch products with variants (including metadata to filter out custom variants)
      const productsResponse = await fetch(`/admin/products?limit=100&fields=id,title,*variants`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })

      if (productsResponse.ok) {
        const productsData = await productsResponse.json()
        // Filter out custom/child variants - only keep base variants
        const filteredProducts = (productsData.products || []).map((product: any) => ({
          ...product,
          variants: (product.variants || []).filter((variant: any) => {
            // Filter out variants that are custom orders (created via customizer)
            const isCustomOrder = variant.metadata?.is_custom_order === true
            const isCustom = variant.metadata?.custom === true
            const hasBaseVariantId = !!variant.metadata?.base_variant_id
            return !isCustomOrder && !isCustom && !hasBaseVariantId
          }),
        }))
        setProducts(filteredProducts)
      }

      // Fetch pricing formulas
      const formulasResponse = await fetch(`/admin/pricing-formulas`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })

      if (formulasResponse.ok) {
        const formulasData = await formulasResponse.json()
        const formulas = formulasData.formulas || []
        setPricingFormulas(formulas)
        
        // Auto-select the default formula for preview calculator
        const defaultFormula = formulas.find((f: PricingFormula) => f.is_default)
        if (defaultFormula) {
          setPreviewFormulaId(defaultFormula.id)
        }
      }
    } catch (err: any) {
      toast.error("Error", { description: err.message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      type: "default",
      status: "draft",
      starts_at: "",
      ends_at: "",
      customer_group_ids: [],
      priority: 0,
    })
    setTiers([
      { min_quantity: 1, max_quantity: 4, price_per_sqm: 120 },
      { min_quantity: 5, max_quantity: 19, price_per_sqm: 100 },
      { min_quantity: 20, max_quantity: null, price_per_sqm: 80 },
    ])
    setSelectedVariantIds([])
    setExpandedProducts(new Set())
  }

  const openCreateModal = () => {
    resetForm()
    setEditingPriceList(null)
    setShowModal(true)
  }

  const openEditModal = async (priceList: PriceList) => {
    try {
      // Fetch full price list with tiers and variants
      const response = await fetch(`/admin/volume-pricing/price-lists/${priceList.id}`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) throw new Error("Failed to fetch price list details")

      const data = await response.json()
      const fullPriceList = data.price_list
      const variantIds = data.variant_ids || []

      setFormData({
        name: fullPriceList.name,
        description: fullPriceList.description || "",
        type: fullPriceList.type,
        status: fullPriceList.status,
        starts_at: fullPriceList.starts_at ? fullPriceList.starts_at.split("T")[0] : "",
        ends_at: fullPriceList.ends_at ? fullPriceList.ends_at.split("T")[0] : "",
        customer_group_ids: fullPriceList.customer_group_ids || [],
        priority: fullPriceList.priority,
      })

      setTiers(
        fullPriceList.tiers?.map((t: any) => ({
          id: t.id,
          min_quantity: t.min_quantity,
          max_quantity: t.max_quantity,
          price_per_sqm: t.price_per_sqm_display || Number(t.price_per_sqm) / 100,
        })) || []
      )

      setSelectedVariantIds(variantIds)
      setEditingPriceList(fullPriceList)
      setShowModal(true)
    } catch (err: any) {
      toast.error("Error", { description: err.message })
    }
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingPriceList(null)
    resetForm()
  }

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error("Validation", { description: "Name is required" })
      return
    }

    if (tiers.length === 0) {
      toast.error("Validation", { description: "At least one pricing tier is required" })
      return
    }

    try {
      setSaving(true)

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
        })),
        variant_ids: selectedVariantIds,
      }

      let response: Response

      if (editingPriceList) {
        response = await fetch(`/admin/volume-pricing/price-lists/${editingPriceList.id}`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      } else {
        response = await fetch(`/admin/volume-pricing/price-lists`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      }

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to save")
      }

      toast.success("Success", {
        description: editingPriceList ? "Price list updated" : "Price list created",
      })

      closeModal()
      await fetchData()
    } catch (err: any) {
      toast.error("Error", { description: err.message })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (priceList: PriceList) => {
    if (!confirm(`Are you sure you want to delete "${priceList.name}"? This will remove the pricing for all linked variants.`)) {
      return
    }

    try {
      const response = await fetch(`/admin/volume-pricing/price-lists/${priceList.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to delete")
      }

      toast.success("Deleted", { description: "Price list deleted successfully" })
      await fetchData()
    } catch (err: any) {
      toast.error("Error", { description: err.message })
    }
  }

  const toggleStatus = async (priceList: PriceList) => {
    const newStatus = priceList.status === "active" ? "draft" : "active"

    try {
      const response = await fetch(`/admin/volume-pricing/price-lists/${priceList.id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) throw new Error("Failed to update status")

      toast.success("Updated", { description: `Price list is now ${newStatus}` })
      await fetchData()
    } catch (err: any) {
      toast.error("Error", { description: err.message })
    }
  }

  const handleDuplicate = async (priceList: PriceList) => {
    const includeVariants = confirm(
      `Duplicate "${priceList.name}"?\n\nClick OK to include variant assignments, or Cancel to create without variants.`
    )

    try {
      const response = await fetch(`/admin/volume-pricing/price-lists/${priceList.id}/duplicate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          include_variants: includeVariants,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to duplicate")
      }

      const data = await response.json()
      toast.success("Duplicated", { 
        description: `Created "${data.price_list.name}" as draft` 
      })
      await fetchData()
      
      // Open the duplicated price list for editing
      openEditModal(data.price_list)
    } catch (err: any) {
      toast.error("Error", { description: err.message })
    }
  }

  // Tier management
  const addTier = () => {
    const lastTier = tiers[tiers.length - 1]
    const newMinQty = lastTier?.max_quantity ? lastTier.max_quantity + 1 : 1

    setTiers([
      ...tiers,
      {
        min_quantity: newMinQty,
        max_quantity: null,
        price_per_sqm: lastTier ? lastTier.price_per_sqm * 0.9 : 80,
      },
    ])
  }

  const removeTier = (index: number) => {
    if (tiers.length <= 1) return
    setTiers(tiers.filter((_, i) => i !== index))
  }

  const updateTier = (index: number, field: keyof Tier, value: any) => {
    setTiers(
      tiers.map((t, i) => (i === index ? { ...t, [field]: value } : t))
    )
  }

  // Variant selection
  const toggleProduct = (productId: string) => {
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

  const toggleVariant = (variantId: string) => {
    setSelectedVariantIds((prev) =>
      prev.includes(variantId)
        ? prev.filter((id) => id !== variantId)
        : [...prev, variantId]
    )
  }

  const toggleAllProductVariants = (product: Product) => {
    const productVariantIds = product.variants.map((v) => v.id)
    const allSelected = productVariantIds.every((id) => selectedVariantIds.includes(id))

    if (allSelected) {
      setSelectedVariantIds((prev) =>
        prev.filter((id) => !productVariantIds.includes(id))
      )
    } else {
      setSelectedVariantIds((prev) => [
        ...prev,
        ...productVariantIds.filter((id) => !prev.includes(id)),
      ])
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

  // Get variants for selected product in simulator
  const simSelectedProduct = products.find((p) => p.id === simProductId)
  const simVariants = simSelectedProduct?.variants || []

  // Filtered price lists (already sorted by priority from fetchData)
  const filteredPriceLists = priceLists
    .filter((pl) => {
      // Name filter
      if (filterName && !pl.name.toLowerCase().includes(filterName.toLowerCase())) {
        return false
      }
      // Type filter
      if (filterType !== "_all" && pl.type !== filterType) {
        return false
      }
      // Status filter
      if (filterStatus !== "_all" && pl.status !== filterStatus) {
        return false
      }
      // Customer group filter
      if (filterCustomerGroup !== "_all") {
        if (!pl.customer_group_ids || !pl.customer_group_ids.includes(filterCustomerGroup)) {
          return false
        }
      }
      return true
    })
    .sort((a, b) => b.priority - a.priority) // Ensure sorted by priority

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    if (draggedId && draggedId !== id) {
      setDragOverId(id)
    }
  }

  const handleDragLeave = () => {
    setDragOverId(null)
  }

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    setDragOverId(null)

    if (!draggedId || draggedId === targetId) {
      setDraggedId(null)
      return
    }

    // Reorder the list
    const draggedIndex = filteredPriceLists.findIndex((pl) => pl.id === draggedId)
    const targetIndex = filteredPriceLists.findIndex((pl) => pl.id === targetId)

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedId(null)
      return
    }

    // Calculate new priorities (swap or insert)
    const newPriceLists = [...priceLists]
    const draggedItem = newPriceLists.find((pl) => pl.id === draggedId)
    const targetItem = newPriceLists.find((pl) => pl.id === targetId)

    if (draggedItem && targetItem) {
      // Swap priorities
      const tempPriority = draggedItem.priority
      draggedItem.priority = targetItem.priority
      targetItem.priority = tempPriority

      // Update locally first for instant feedback
      setPriceLists(newPriceLists.sort((a, b) => b.priority - a.priority))

      // Update on server
      try {
        await Promise.all([
          fetch(`/admin/volume-pricing/price-lists/${draggedItem.id}`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ priority: draggedItem.priority }),
          }),
          fetch(`/admin/volume-pricing/price-lists/${targetItem.id}`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ priority: targetItem.priority }),
          }),
        ])
        toast.success("Updated", { description: "Priority order updated" })
      } catch (err: any) {
        toast.error("Error", { description: "Failed to update priorities" })
        await fetchData() // Refresh on error
      }
    }

    setDraggedId(null)
  }

  const handleDragEnd = () => {
    setDraggedId(null)
    setDragOverId(null)
  }

  // Full pricing simulator (uses real API)
  const runSimulation = async () => {
    if (!simVariantId || !simProductId) {
      toast.error("Error", { description: "Please select a product and variant" })
      return
    }

    setSimulatingPrice(true)
    setSimResult(null)

    try {
      const response = await fetch(`/admin/volume-pricing/calculate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variant_id: simVariantId,
          width_cm: simWidth,
          height_cm: simHeight,
          quantity: simQuantity,
          customer_group_ids: simCustomerGroupId ? [simCustomerGroupId] : [],
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to calculate price")
      }

      const data = await response.json()
      setSimResult({
        price_per_item: data.price_per_item,
        total_price: data.total_price,
        price_per_sqm: data.price_per_sqm,
        price_list_name: data.price_list_name,
        sqm: data.dimensions?.sqm || (simWidth * simHeight) / 10000,
      })
    } catch (err: any) {
      toast.error("Error", { description: err.message })
    } finally {
      setSimulatingPrice(false)
    }
  }

  // Preview calculator (in modal)
  const calculatePreview = async () => {
    if (tiers.length === 0) {
      toast.error("Error", { description: "Add at least one pricing tier first" })
      return
    }

    setCalculatingPreview(true)
    
    try {
      // Get dimensions
      const size = PRESET_SIZES[previewSizeIndex]
      const width = size.width === 0 ? previewCustomWidth : size.width
      const height = size.height === 0 ? previewCustomHeight : size.height
      const sqm = (width * height) / 10000
      
      // Find applicable tier based on quantity
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

      // If formula selected, use API to calculate
      if (previewFormulaId) {
        try {
          const response = await fetch(`/admin/pricing-formulas/${previewFormulaId}/calculate`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              variables: {
                width_value: width,
                length_value: height,
                price_per_sqm: pricePerSqm,
              },
              volumeMultiplier: 1.0,
            }),
          })

          if (response.ok) {
            const data = await response.json()
            pricePerItem = data.price || pricePerItem
          } else {
            const errorData = await response.json()
            console.error("Formula calculation failed:", errorData)
          }
        } catch (err) {
          console.error("Formula calculation failed, using sqm:", err)
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
      <Container className="p-6">
        <div className="flex items-center justify-center py-12">
          <Text>Loading volume pricing...</Text>
        </div>
      </Container>
    )
  }

  return (
    <Container className="p-6">
      <Toaster />

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Heading level="h1" className="text-xl">
            Volume Pricing
          </Heading>
          <Text className="text-gray-600">
            Create global price lists with tiered pricing and assign them to product variants
          </Text>
        </div>
        <Button onClick={openCreateModal}>Create Price List</Button>
      </div>

      {/* Info Box */}
      <div className="mb-6 rounded-lg bg-blue-50 p-4">
        <Text className="text-sm text-blue-900">
          <strong>How it works:</strong> Create price lists with quantity-based pricing tiers (€/m²). 
          Assign variants to price lists. For customer-specific pricing, select customer groups. 
          Price lists are evaluated by priority (higher = checked first). Drag rows to reorder priorities.
        </Text>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs text-gray-500">Search</Label>
          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="Search by name..."
              className="pl-9"
            />
          </div>
        </div>
        <div className="w-[150px]">
          <Label className="text-xs text-gray-500">Type</Label>
          <Select value={filterType} onValueChange={setFilterType}>
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="_all">All Types</Select.Item>
              <Select.Item value="default">Default</Select.Item>
              <Select.Item value="customer_group">Customer Group</Select.Item>
              <Select.Item value="sale">Sale</Select.Item>
            </Select.Content>
          </Select>
        </div>
        <div className="w-[150px]">
          <Label className="text-xs text-gray-500">Status</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="_all">All Statuses</Select.Item>
              <Select.Item value="active">Active</Select.Item>
              <Select.Item value="draft">Draft</Select.Item>
            </Select.Content>
          </Select>
        </div>
        <div className="w-[180px]">
          <Label className="text-xs text-gray-500">Customer Group</Label>
          <Select value={filterCustomerGroup} onValueChange={setFilterCustomerGroup}>
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="_all">All Groups</Select.Item>
              {customerGroups.map((group) => (
                <Select.Item key={group.id} value={group.id}>
                  {group.name}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
        {(filterName || filterType !== "_all" || filterStatus !== "_all" || filterCustomerGroup !== "_all") && (
          <Button
            variant="secondary"
            size="small"
            onClick={() => {
              setFilterName("")
              setFilterType("_all")
              setFilterStatus("_all")
              setFilterCustomerGroup("_all")
            }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Results count */}
      {priceLists.length > 0 && (
        <div className="mb-2 text-sm text-gray-500">
          Showing {filteredPriceLists.length} of {priceLists.length} price lists
        </div>
      )}

      {/* Price Lists */}
      {priceLists.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
          <Text className="text-gray-500">No price lists yet</Text>
          <Text className="mt-2 text-sm text-gray-400">
            Create a price list to define volume pricing for your products
          </Text>
          <Button className="mt-4" onClick={openCreateModal}>
            Create Your First Price List
          </Button>
        </div>
      ) : filteredPriceLists.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
          <Text className="text-gray-500">No price lists match your filters</Text>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => {
              setFilterName("")
              setFilterType("_all")
              setFilterStatus("_all")
              setFilterCustomerGroup("_all")
            }}
          >
            Clear Filters
          </Button>
        </div>
      ) : (
        <div className="-mx-6">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell className="w-8"></Table.HeaderCell>
                <Table.HeaderCell>Name</Table.HeaderCell>
                <Table.HeaderCell>Type</Table.HeaderCell>
                <Table.HeaderCell>Customer Groups</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>Tiers</Table.HeaderCell>
                <Table.HeaderCell>Variants</Table.HeaderCell>
                <Table.HeaderCell>Priority</Table.HeaderCell>
                <Table.HeaderCell>Actions</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {filteredPriceLists.map((pl) => (
                <Table.Row
                  key={pl.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, pl.id)}
                  onDragOver={(e) => handleDragOver(e, pl.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, pl.id)}
                  onDragEnd={handleDragEnd}
                  className={`cursor-grab transition-colors ${
                    draggedId === pl.id ? "opacity-50 bg-gray-100" : ""
                  } ${dragOverId === pl.id ? "bg-blue-50 border-t-2 border-blue-500" : ""}`}
                >
                  <Table.Cell className="w-8 text-gray-400">
                    <div className="flex flex-col gap-0.5 cursor-grab">
                      <span className="text-xs">⋮⋮</span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div>
                      <Text className="font-medium">{pl.name}</Text>
                      {pl.description && (
                        <Text className="text-sm text-gray-500">{pl.description}</Text>
                      )}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge
                      color={
                        pl.type === "default"
                          ? "blue"
                          : pl.type === "customer_group"
                          ? "purple"
                          : "orange"
                      }
                    >
                      {pl.type === "customer_group" ? "Customer Group" : pl.type}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    {pl.customer_group_ids && pl.customer_group_ids.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {pl.customer_group_ids.slice(0, 2).map((groupId) => {
                          const group = customerGroups.find((g) => g.id === groupId)
                          return (
                            <Badge key={groupId} color="purple" size="small">
                              {group?.name || groupId.slice(-6)}
                            </Badge>
                          )
                        })}
                        {pl.customer_group_ids.length > 2 && (
                          <Badge color="grey" size="small">
                            +{pl.customer_group_ids.length - 2}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <Text className="text-xs text-gray-400">All customers</Text>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={pl.status === "active"}
                        onCheckedChange={() => toggleStatus(pl)}
                      />
                      <Badge color={pl.status === "active" ? "green" : "grey"}>
                        {pl.status}
                      </Badge>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge size="small" color="grey">
                      {pl.tier_count || 0} tier(s)
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge size="small" color="grey">
                      {pl.variant_count || 0} variant(s)
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color="blue" size="small">
                      {pl.priority}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-2">
                      <Button variant="transparent" size="small" onClick={() => openEditModal(pl)}>
                        Edit
                      </Button>
                      <Button variant="transparent" size="small" onClick={() => handleDuplicate(pl)}>
                        Duplicate
                      </Button>
                      <Button
                        variant="transparent"
                        size="small"
                        className="text-red-600"
                        onClick={() => handleDelete(pl)}
                      >
                        Delete
                      </Button>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      )}

      {/* Full Pricing Simulator */}
      <div className="mt-8 rounded-lg border border-gray-200 bg-gray-50 p-6">
        <Heading level="h2" className="mb-4 text-lg">
          Pricing Simulator
        </Heading>
        <Text className="mb-4 text-sm text-gray-600">
          Test pricing as if you were a customer. Select a customer group to simulate customer-specific pricing.
        </Text>

        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {/* Customer Group Selection */}
          <div>
            <Label className="text-xs">Simulate Customer Group</Label>
            <Select
              value={simCustomerGroupId || "_all"}
              onValueChange={(value) => setSimCustomerGroupId(value === "_all" ? "" : value)}
            >
              <Select.Trigger>
                <Select.Value placeholder="All customers (default)" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="_all">All customers (default pricing)</Select.Item>
                {customerGroups.map((group) => (
                  <Select.Item key={group.id} value={group.id}>
                    {group.name}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>

          {/* Product Selection */}
          <div>
            <Label className="text-xs">Product</Label>
            <Select
              value={simProductId || "_none"}
              onValueChange={(value) => {
                setSimProductId(value === "_none" ? "" : value)
                setSimVariantId("") // Reset variant when product changes
              }}
            >
              <Select.Trigger>
                <Select.Value placeholder="Select product" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="_none">Select a product</Select.Item>
                {products.map((product) => (
                  <Select.Item key={product.id} value={product.id}>
                    {product.title}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>

          {/* Variant Selection */}
          <div>
            <Label className="text-xs">Variant</Label>
            <Select
              value={simVariantId || "_none"}
              onValueChange={(value) => setSimVariantId(value === "_none" ? "" : value)}
              disabled={!simProductId}
            >
              <Select.Trigger>
                <Select.Value placeholder={simProductId ? "Select variant" : "Select product first"} />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="_none">Select a variant</Select.Item>
                {simVariants.map((variant) => (
                  <Select.Item key={variant.id} value={variant.id}>
                    {variant.title}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>

          {/* Quantity */}
          <div>
            <Label className="text-xs">Quantity</Label>
            <Input
              type="number"
              min="1"
              value={simQuantity}
              onChange={(e) => setSimQuantity(parseInt(e.target.value) || 1)}
            />
          </div>
        </div>

        {/* Size Inputs */}
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div>
            <Label className="text-xs">Width (cm)</Label>
            <Input
              type="number"
              min="1"
              value={simWidth}
              onChange={(e) => setSimWidth(parseInt(e.target.value) || 1)}
            />
          </div>
          <div>
            <Label className="text-xs">Height (cm)</Label>
            <Input
              type="number"
              min="1"
              value={simHeight}
              onChange={(e) => setSimHeight(parseInt(e.target.value) || 1)}
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={runSimulation}
              disabled={simulatingPrice || !simVariantId}
              className="w-full"
            >
              {simulatingPrice ? "Calculating..." : "Calculate Price"}
            </Button>
          </div>
          {simResult && (
            <div className="flex items-end">
              <div className="w-full rounded bg-green-50 p-3 text-center">
                <Text className="text-xs text-gray-500">Total Price</Text>
                <Text className="text-2xl font-bold text-green-600">
                  €{simResult.total_price.toFixed(2)}
                </Text>
              </div>
            </div>
          )}
        </div>

        {/* Simulation Results */}
        {simResult && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <div>
                <Text className="text-xs text-gray-500">Price List Used</Text>
                <Text className="font-medium">
                  {simResult.price_list_name || "Default (metadata fallback)"}
                </Text>
              </div>
              <div>
                <Text className="text-xs text-gray-500">Price per m²</Text>
                <Text className="font-medium">€{simResult.price_per_sqm.toFixed(2)}</Text>
              </div>
              <div>
                <Text className="text-xs text-gray-500">Size</Text>
                <Text className="font-medium">{simResult.sqm.toFixed(4)} m²</Text>
              </div>
              <div>
                <Text className="text-xs text-gray-500">Price per Item</Text>
                <Text className="font-medium">€{simResult.price_per_item.toFixed(2)}</Text>
              </div>
              <div>
                <Text className="text-xs text-gray-500">Total ({simQuantity}x)</Text>
                <Text className="text-lg font-bold text-green-600">
                  €{simResult.total_price.toFixed(2)}
                </Text>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <FocusModal open={showModal} onOpenChange={setShowModal}>
        <FocusModal.Content className="max-h-[90vh] overflow-hidden">
          <FocusModal.Header>
            <Heading level="h2">
              {editingPriceList ? "Edit Price List" : "Create Price List"}
            </Heading>
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

                {/* Customer Groups (shown when type is customer_group) */}
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
                  
                  {/* Formula Selection */}
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
                        {pricingFormulas.map((formula) => (
                          <Select.Item key={formula.id} value={formula.id}>
                            {formula.name} {formula.is_default ? "★" : ""}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select>
                  </div>
                  
                  {/* Size Selection */}
                  <div className="mb-3">
                    <Label className="text-xs">Size</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {PRESET_SIZES.map((size, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setPreviewSizeIndex(idx)}
                          className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                            previewSizeIndex === idx
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white border-gray-200 hover:border-blue-300"
                          }`}
                        >
                          {size.label}
                        </button>
                      ))}
                    </div>
                    
                    {/* Custom size inputs */}
                    {PRESET_SIZES[previewSizeIndex]?.width === 0 && (
                      <div className="flex gap-2 mt-2">
                        <Input
                          type="number"
                          value={previewCustomWidth}
                          onChange={(e) => setPreviewCustomWidth(parseInt(e.target.value) || 30)}
                          className="w-20"
                          placeholder="Width"
                        />
                        <span className="text-gray-400 self-center">×</span>
                        <Input
                          type="number"
                          value={previewCustomHeight}
                          onChange={(e) => setPreviewCustomHeight(parseInt(e.target.value) || 30)}
                          className="w-20"
                          placeholder="Height"
                        />
                        <span className="text-gray-500 self-center text-sm">cm</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Quantity */}
                  <div className="mb-3">
                    <Label className="text-xs">Quantity</Label>
                    <div className="flex gap-2 mt-1">
                      {[1, 5, 10, 20, 50].map((qty) => (
                        <button
                          key={qty}
                          type="button"
                          onClick={() => setPreviewQuantity(qty)}
                          className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                            previewQuantity === qty
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white border-gray-200 hover:border-blue-300"
                          }`}
                        >
                          {qty}
                        </button>
                      ))}
                      <Input
                        type="number"
                        min="1"
                        value={previewQuantity}
                        onChange={(e) => setPreviewQuantity(parseInt(e.target.value) || 1)}
                        className="w-16"
                      />
                    </div>
                  </div>
                  
                  {/* Calculate Button */}
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={calculatePreview}
                    disabled={calculatingPreview || tiers.length === 0}
                    className="w-full"
                  >
                    {calculatingPreview ? "Calculating..." : "Calculate Price"}
                  </Button>
                  
                  {/* Result */}
                  {previewResult && (
                    <div className="mt-3 p-3 bg-white rounded border border-blue-200">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <Text className="text-xs text-gray-500">Tier used:</Text>
                          <Text className="font-medium">{previewResult.tier_used}</Text>
                        </div>
                        <div>
                          <Text className="text-xs text-gray-500">Price per m²:</Text>
                          <Text className="font-medium">€{previewResult.price_per_sqm.toFixed(2)}</Text>
                        </div>
                        <div>
                          <Text className="text-xs text-gray-500">Size (m²):</Text>
                          <Text className="font-medium">{previewResult.sqm.toFixed(4)}</Text>
                        </div>
                        <div>
                          <Text className="text-xs text-gray-500">Price per item:</Text>
                          <Text className="font-medium">€{previewResult.price_per_item.toFixed(2)}</Text>
                        </div>
                        <div className="col-span-2 pt-2 border-t border-gray-100">
                          <Text className="text-xs text-gray-500">Total ({previewQuantity}x):</Text>
                          <Text className="text-lg font-bold text-green-600">
                            €{previewResult.total_price.toFixed(2)}
                          </Text>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column - Variant Selection */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Heading level="h3" className="text-base">
                    Assign Variants ({selectedVariantIds.length} selected)
                  </Heading>
                </div>
                <Text className="text-sm text-gray-500">
                  Select which product variants should use this price list
                </Text>

                <div className="max-h-[400px] overflow-y-auto rounded border border-gray-200">
                  {products.map((product) => {
                    const isExpanded = expandedProducts.has(product.id)
                    const productVariantIds = product.variants?.map((v) => v.id) || []
                    const selectedCount = productVariantIds.filter((id) =>
                      selectedVariantIds.includes(id)
                    ).length
                    const allSelected = selectedCount === productVariantIds.length && productVariantIds.length > 0

                    return (
                      <div key={product.id} className="border-b border-gray-100 last:border-b-0">
                        <div
                          className="flex cursor-pointer items-center gap-3 p-3 hover:bg-gray-50"
                          onClick={() => toggleProduct(product.id)}
                        >
                          <span className="text-gray-400">{isExpanded ? "▼" : "▶"}</span>
                          <Checkbox
                            checked={allSelected}
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleAllProductVariants(product)
                            }}
                          />
                          <div className="flex-1">
                            <Text className="font-medium">{product.title}</Text>
                            <Text className="text-xs text-gray-500">
                              {selectedCount}/{productVariantIds.length} variants selected
                            </Text>
                          </div>
                        </div>

                        {isExpanded && product.variants && (
                          <div className="border-t border-gray-100 bg-gray-50">
                            {product.variants.map((variant) => (
                              <div
                                key={variant.id}
                                className={`flex cursor-pointer items-center gap-3 py-2 pl-10 pr-3 hover:bg-gray-100 ${
                                  selectedVariantIds.includes(variant.id) ? "bg-blue-50" : ""
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
              </div>
            </div>
          </FocusModal.Body>
          <FocusModal.Footer>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={closeModal}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? "Saving..." : editingPriceList ? "Update" : "Create"}
              </Button>
            </div>
          </FocusModal.Footer>
        </FocusModal.Content>
      </FocusModal>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Volume Pricing",
  icon: CurrencyDollar,
})

export default VolumePricingPage

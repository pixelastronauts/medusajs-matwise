import React, { useState, useEffect, useRef } from "react"
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Badge, Text, Heading, Table, Button, toast } from "@medusajs/ui"
import { useParams } from "react-router-dom"
import { ArrowPath, EyeSlash, Eye, PencilSquare, Star, StarSolid, DotsSix } from "@medusajs/icons"

type Variant = {
  id: string
  title: string
  sku: string | null
  created_at: string
  metadata?: Record<string, any>
}

type VariantStats = {
  total: number
  base: number
  custom: number
}

const ProductBaseVariantsWidget = () => {
  const { id: productId } = useParams()

  const [baseVariants, setBaseVariants] = useState<Variant[]>([])
  const [customVariants, setCustomVariants] = useState<Variant[]>([])
  const [stats, setStats] = useState<VariantStats>({ total: 0, base: 0, custom: 0 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [defaultVariantId, setDefaultVariantId] = useState<string | null>(null)
  
  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const dragCounter = useRef(0)

  useEffect(() => {
    fetchVariants()
  }, [productId])

  const fetchVariants = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/admin/products/${productId}?fields=*variants`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })

      if (response.ok) {
        const data = await response.json()
        const allVariants = data.product?.variants || []
        
        // Separate base vs custom variants
        const base: Variant[] = []
        const custom: Variant[] = []
        let foundDefaultId: string | null = null
        
        allVariants.forEach((v: Variant) => {
          const isCustomOrder = v.metadata?.is_custom_order === true
          const isCustom = v.metadata?.custom === true
          const hasBaseVariantId = !!v.metadata?.base_variant_id
          
          if (isCustomOrder || isCustom || hasBaseVariantId) {
            custom.push(v)
          } else {
            base.push(v)
            // Check if this is the default variant
            if (v.metadata?.is_default_variant === true) {
              foundDefaultId = v.id
            }
          }
        })
        
        // Sort base variants by sort_order metadata
        base.sort((a, b) => {
          const orderA = a.metadata?.sort_order ?? 9999
          const orderB = b.metadata?.sort_order ?? 9999
          return orderA - orderB
        })
        
        setBaseVariants(base)
        setCustomVariants(custom)
        setDefaultVariantId(foundDefaultId)
        setStats({
          total: allVariants.length,
          base: base.length,
          custom: custom.length,
        })
      } else {
        setError("Failed to fetch variants")
      }
    } catch (err) {
      setError("Failed to load variants")
    } finally {
      setLoading(false)
    }
  }

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', index.toString())
    // Add a slight delay to allow the drag image to be created
    setTimeout(() => {
      const target = e.target as HTMLElement
      target.style.opacity = '0.5'
    }, 0)
  }

  const handleDragEnd = (e: React.DragEvent) => {
    const target = e.target as HTMLElement
    target.style.opacity = '1'
    setDraggedIndex(null)
    setDragOverIndex(null)
    dragCounter.current = 0
  }

  const handleDragEnter = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    dragCounter.current++
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) {
      setDragOverIndex(null)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    dragCounter.current = 0
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null)
      setDragOverIndex(null)
      return
    }

    const newVariants = [...baseVariants]
    const [draggedItem] = newVariants.splice(draggedIndex, 1)
    newVariants.splice(dropIndex, 0, draggedItem)
    
    setBaseVariants(newVariants)
    setDraggedIndex(null)
    setDragOverIndex(null)
    
    // Auto-save after drop
    await saveOrder(newVariants, defaultVariantId)
  }

  const toggleDefaultVariant = async (variantId: string) => {
    const newDefaultId = defaultVariantId === variantId ? null : variantId
    setDefaultVariantId(newDefaultId)
    // Auto-save when toggling default
    await saveOrder(baseVariants, newDefaultId)
  }

  const saveOrder = async (variants: Variant[], defaultId: string | null) => {
    try {
      setSaving(true)
      
      const sortedVariants = variants.map((v, index) => ({
        variant_id: v.id,
        sort_order: index,
      }))

      const response = await fetch(`/admin/products/${productId}/variants/sort`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sorted_variants: sortedVariants,
          default_variant_id: defaultId,
        }),
      })

      if (response.ok) {
        toast.success("Saved")
      } else {
        const errorData = await response.json()
        toast.error(errorData.message || "Failed to save")
        // Refetch to restore state on error
        await fetchVariants()
      }
    } catch (err) {
      toast.error("Failed to save")
      await fetchVariants()
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Container className="p-4">
        <div className="flex items-center gap-2">
          <ArrowPath className="w-4 h-4 animate-spin" />
          <Text className="text-sm text-gray-500">Loading variants...</Text>
        </div>
      </Container>
    )
  }

  if (error) {
    return (
      <Container className="p-4">
        <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      </Container>
    )
  }

  return (
    <Container className="p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <Heading level="h2" className="text-base">Variant Summary</Heading>
          {saving && (
            <ArrowPath className="w-3 h-3 animate-spin text-gray-400" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge color="green" size="small">
            {stats.base} base
          </Badge>
          {stats.custom > 0 && (
            <Badge color="grey" size="small">
              {stats.custom} custom
            </Badge>
          )}
        </div>
      </div>

      <div className="divide-y">
        {baseVariants.length === 0 ? (
          <Text className="text-sm text-gray-500 italic px-6 pb-4">No base variants found</Text>
        ) : (
          <div className="bg-gray-50 rounded overflow-hidden">
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell className="text-xs w-10"></Table.HeaderCell>
                  <Table.HeaderCell className="text-xs">Title</Table.HeaderCell>
                  <Table.HeaderCell className="text-xs">SKU</Table.HeaderCell>
                  <Table.HeaderCell className="text-xs w-16 text-center">Default</Table.HeaderCell>
                  <Table.HeaderCell className="text-xs w-10"></Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {baseVariants.slice(0, showDetails ? undefined : 5).map((variant, index) => (
                  <Table.Row 
                    key={variant.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnd={handleDragEnd}
                    onDragEnter={(e) => handleDragEnter(e, index)}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    className={`
                      cursor-grab active:cursor-grabbing transition-all duration-150
                      ${draggedIndex === index ? 'opacity-50' : ''}
                      ${dragOverIndex === index ? 'bg-blue-50 border-t-2 border-blue-400' : ''}
                    `}
                  >
                    <Table.Cell className="text-xs">
                      <div className="flex items-center">
                        <DotsSix className="w-4 h-4 text-gray-400 cursor-grab" />
                      </div>
                    </Table.Cell>
                    <Table.Cell className="text-xs">{variant.title || '-'}</Table.Cell>
                    <Table.Cell className="text-xs font-mono text-gray-500">
                      {variant.sku || '-'}
                    </Table.Cell>
                    <Table.Cell className="text-xs text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleDefaultVariant(variant.id)
                        }}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                        title={defaultVariantId === variant.id ? "Remove as base price variant" : "Set as base price variant"}
                      >
                        {defaultVariantId === variant.id ? (
                          <StarSolid className="w-4 h-4 text-yellow-500" />
                        ) : (
                          <Star className="w-4 h-4 text-gray-400 hover:text-yellow-500" />
                        )}
                      </button>
                    </Table.Cell>
                    <Table.Cell>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          e.preventDefault()
                          window.location.href = `/app/products/${productId}/variants/${variant.id}`
                        }}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                      >
                        <PencilSquare className="w-3 h-3 text-gray-500" />
                      </button>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
            
            {baseVariants.length > 5 && (
              <div className="p-2 border-t">
                <Button
                  variant="transparent"
                  size="small"
                  onClick={() => setShowDetails(!showDetails)}
                  className="w-full"
                >
                  {showDetails ? (
                    <>
                      <EyeSlash className="w-3 h-3 mr-1" />
                      Show less
                    </>
                  ) : (
                    <>
                      <Eye className="w-3 h-3 mr-1" />
                      Show all {baseVariants.length} variants
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Helper text */}
      {baseVariants.length > 0 && (
        <div className="px-6 py-3 border-t">
          <Text className="text-xs text-gray-500">
            <DotsSix className="w-3 h-3 inline-block text-gray-400 mr-1" />
            <span>Drag to reorder variants.</span>
            <StarSolid className="w-3 h-3 inline-block text-yellow-500 mx-1" />
            <span>Mark as "default" to use as base price on the frontend.</span>
          </Text>
        </div>
      )}

      {showDetails && stats.custom > 0 && (
        <div className="mt-3 pt-3 border-t px-6">
          <Text className="text-sm text-gray-600 font-medium mb-2">
            Custom Variants ({stats.custom})
          </Text>
          <div className="bg-gray-50 rounded overflow-hidden max-h-48 overflow-y-auto">
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell className="text-xs">Title</Table.HeaderCell>
                  <Table.HeaderCell className="text-xs">SKU</Table.HeaderCell>
                  <Table.HeaderCell className="text-xs">Created</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {customVariants.map((variant) => (
                  <Table.Row key={variant.id} className="opacity-60">
                    <Table.Cell className="text-xs">{variant.title || '-'}</Table.Cell>
                    <Table.Cell className="text-xs font-mono text-gray-500 truncate max-w-[200px]">
                      {variant.sku || '-'}
                    </Table.Cell>
                    <Table.Cell className="text-xs text-gray-400">
                      {new Date(variant.created_at).toLocaleDateString()}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        </div>
      )}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.side.after",
})

export default ProductBaseVariantsWidget

import React, { useState, useEffect } from "react"
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Badge, Text, Heading, Table, Button } from "@medusajs/ui"
import { useParams } from "react-router-dom"
import { ArrowPath, EyeSlash, Eye, PencilSquare } from "@medusajs/icons"

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

  const [variants, setVariants] = useState<Variant[]>([])
  const [baseVariants, setBaseVariants] = useState<Variant[]>([])
  const [customVariants, setCustomVariants] = useState<Variant[]>([])
  const [stats, setStats] = useState<VariantStats>({ total: 0, base: 0, custom: 0 })
  const [loading, setLoading] = useState(true)
  const [showDetails, setShowDetails] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        
        allVariants.forEach((v: Variant) => {
          const isCustomOrder = v.metadata?.is_custom_order === true
          const isCustom = v.metadata?.custom === true
          const hasBaseVariantId = !!v.metadata?.base_variant_id
          
          if (isCustomOrder || isCustom || hasBaseVariantId) {
            custom.push(v)
          } else {
            base.push(v)
          }
        })
        
        setVariants(allVariants)
        setBaseVariants(base)
        setCustomVariants(custom)
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
        <Heading level="h2" className="text-base">Variant Summary</Heading>
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
          <Text className="text-sm text-gray-500 italic">No base variants found</Text>
        ) : (
          <div className="bg-gray-50 rounded overflow-hidden">
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell className="text-xs">Title</Table.HeaderCell>
                  <Table.HeaderCell className="text-xs">SKU</Table.HeaderCell>
                  <Table.HeaderCell className="text-xs w-10"></Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {baseVariants.slice(0, showDetails ? undefined : 5).map((variant) => (
                  <Table.Row key={variant.id}>
                    <Table.Cell className="text-xs">{variant.title || '-'}</Table.Cell>
                    <Table.Cell className="text-xs font-mono text-gray-500">
                      {variant.sku || '-'}
                    </Table.Cell>
                    <Table.Cell>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          e.preventDefault()
                          // Use window.location for full page nav (bypasses React Router drawer behavior)
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

      {showDetails && stats.custom > 0 && (
        <div className="mt-3 pt-3 border-t">
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


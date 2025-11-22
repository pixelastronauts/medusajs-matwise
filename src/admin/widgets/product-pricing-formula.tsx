import React, { useState, useEffect } from "react"
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Button, Select, Label, Badge, Text, Heading } from "@medusajs/ui"
import { useParams } from "react-router-dom"
import { CurrencyDollar, XCircle, CheckCircle } from "@medusajs/icons"

const ProductPricingFormulaWidget = () => {
  const { id: productId } = useParams()
  
  const [formulas, setFormulas] = useState<any[]>([])
  const [selectedFormula, setSelectedFormula] = useState<string>("")
  const [currentFormula, setCurrentFormula] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  useEffect(() => {
    fetchData()
  }, [productId])

  const fetchData = async () => {
    try {
      setLoading(true)

      // Fetch all formulas
      const formulasResponse = await fetch("/admin/pricing-formulas", {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })

      if (formulasResponse.ok) {
        const formulasData = await formulasResponse.json()
        setFormulas(formulasData.formulas || [])
      }

      // Fetch product to check current formula
      const productResponse = await fetch(`/admin/products/${productId}`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })

      if (productResponse.ok) {
        const productData = await productResponse.json()
        const formulaId = productData.product?.metadata?.pricing_formula_id

        if (formulaId) {
          setSelectedFormula(formulaId)
          
          // Fetch formula details
          const formulaResponse = await fetch(`/admin/pricing-formulas/${formulaId}`, {
            credentials: "include",
            headers: { "Content-Type": "application/json" },
          })

          if (formulaResponse.ok) {
            const formulaData = await formulaResponse.json()
            setCurrentFormula(formulaData.formula)
          }
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  const attachFormula = async () => {
    if (!selectedFormula) return

    try {
      setSaving(true)
      setMessage(null)

      const response = await fetch(`/admin/products/${productId}/pricing-formula`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formula_id: selectedFormula }),
      })

      if (response.ok) {
        setMessage({ type: "success", text: "Pricing formula attached successfully!" })
        await fetchData()
      } else {
        const errorData = await response.json()
        setMessage({ type: "error", text: errorData.message || "Failed to attach formula" })
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message })
    } finally {
      setSaving(false)
    }
  }

  const detachFormula = async () => {
    if (!confirm("Are you sure you want to remove the pricing formula from this product?")) {
      return
    }

    try {
      setSaving(true)
      setMessage(null)

      const response = await fetch(`/admin/products/${productId}/pricing-formula`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })

      if (response.ok) {
        setMessage({ type: "success", text: "Pricing formula removed successfully!" })
        setSelectedFormula("")
        setCurrentFormula(null)
        await fetchData()
      } else {
        const errorData = await response.json()
        setMessage({ type: "error", text: errorData.message || "Failed to remove formula" })
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Container className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <CurrencyDollar />
          <Heading level="h2">Pricing Formula</Heading>
        </div>
        <Text>Loading...</Text>
      </Container>
    )
  }

  return (
    <Container className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CurrencyDollar />
          <Heading level="h2">Pricing Formula</Heading>
        </div>
        {currentFormula && (
          <Badge color="green" size="small">
            <CheckCircle className="mr-1" />
            Formula Active
          </Badge>
        )}
      </div>

      {message && (
        <div
          className={`mb-4 p-3 rounded ${
            message.type === "success"
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {currentFormula ? (
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded border">
            <div className="space-y-2">
              <div>
                <Label>Current Formula</Label>
                <Text className="font-semibold">{currentFormula.name}</Text>
              </div>
              {currentFormula.description && (
                <div>
                  <Label>Description</Label>
                  <Text className="text-sm text-gray-600">{currentFormula.description}</Text>
                </div>
              )}
              <div>
                <Label>Formula</Label>
                <code className="block text-xs bg-white p-2 rounded border mt-1 font-mono overflow-x-auto">
                  {currentFormula.formula_string}
                </code>
              </div>
              <div>
                <Label>Parameters</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {Object.entries(currentFormula.parameters || {}).map(([key, value]) => (
                    <div key={key} className="text-xs bg-white p-2 rounded border">
                      <span className="font-mono text-gray-600">{key}:</span>{" "}
                      <span className="font-semibold">{value as string}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="danger"
              onClick={detachFormula}
              disabled={saving}
            >
              <XCircle className="mr-2" />
              Remove Formula
            </Button>
            <Button
              variant="secondary"
              onClick={() => window.open(`/pricing-formulas/${currentFormula.id}`, '_blank')}
            >
              Edit Formula
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Text className="text-sm text-gray-600">
            No pricing formula attached. Select one to enable dynamic pricing for this product.
          </Text>

          {formulas.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
              <Text className="text-sm text-yellow-800">
                No pricing formulas available. Create one first in the Pricing Formulas section.
              </Text>
            <Button
              variant="secondary"
              onClick={() => window.open('/pricing-formulas/create', '_blank')}
              className="mt-2"
            >
              Create Formula
            </Button>
            </div>
          ) : (
            <>
              <div>
                <Label htmlFor="formula-select">Select Pricing Formula</Label>
                <Select
                  id="formula-select"
                  value={selectedFormula}
                  onValueChange={setSelectedFormula}
                >
                  <Select.Trigger>
                    <Select.Value placeholder="Choose a formula..." />
                  </Select.Trigger>
                  <Select.Content>
                    {formulas
                      .filter((f) => f.is_active)
                      .map((formula) => (
                        <Select.Item key={formula.id} value={formula.id}>
                          {formula.name}
                          {formula.description && (
                            <span className="text-xs text-gray-500 ml-2">
                              - {formula.description.substring(0, 50)}
                              {formula.description.length > 50 && "..."}
                            </span>
                          )}
                        </Select.Item>
                      ))}
                  </Select.Content>
                </Select>
              </div>

              <Button
                variant="primary"
                onClick={attachFormula}
                disabled={!selectedFormula || saving}
              >
                <CheckCircle className="mr-2" />
                {saving ? "Attaching..." : "Attach Formula"}
              </Button>
            </>
          )}
        </div>
      )}

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
        <Text className="text-xs text-blue-800">
          💡 <strong>Tip:</strong> Pricing formulas use variant sqm prices and apply custom calculations.
          Make sure your variants have volume_pricing_tiers in their metadata.
        </Text>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default ProductPricingFormulaWidget


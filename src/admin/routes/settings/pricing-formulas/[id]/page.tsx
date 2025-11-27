import React, { useState, useEffect } from "react"
import { Container, Heading, Button, Input, Textarea, Label, Switch } from "@medusajs/ui"
import { useNavigate, useParams } from "react-router-dom"

type Parameter = {
  key: string
  value: number
}

type PricingFormula = {
  id: string
  name: string
  description: string | null
  formula_string: string
  parameters: Record<string, number>
  is_active: boolean
  created_at: string
  updated_at: string
}

const EditPricingFormulaPage = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [formulaString, setFormulaString] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [parameters, setParameters] = useState<Parameter[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (id) {
      fetchFormula()
    }
  }, [id])

  const fetchFormula = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/admin/pricing-formulas/${id}`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch pricing formula")
      }

      const data = await response.json()
      const formula: PricingFormula = data.formula

      setName(formula.name)
      setDescription(formula.description || "")
      setFormulaString(formula.formula_string)
      setIsActive(formula.is_active)
      setParameters(
        Object.entries(formula.parameters).map(([key, value]) => ({
          key,
          value,
        }))
      )
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const addParameter = () => {
    setParameters([...parameters, { key: "", value: 0 }])
  }

  const updateParameter = (index: number, field: "key" | "value", value: string | number) => {
    const newParameters = [...parameters]
    newParameters[index][field] = value as any
    setParameters(newParameters)
  }

  const removeParameter = (index: number) => {
    setParameters(parameters.filter((_, i) => i !== index))
  }

  const saveFormula = async () => {
    if (!name || !formulaString) {
      setError("Name and formula string are required")
      return
    }

    try {
      setSaving(true)
      setError(null)

      const parametersObj = parameters.reduce((acc, param) => {
        if (param.key) acc[param.key] = param.value
        return acc
      }, {} as Record<string, number>)

      const response = await fetch(`/admin/pricing-formulas/${id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          formula_string: formulaString,
          parameters: parametersObj,
          is_active: isActive,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to update pricing formula")
      }

      navigate("/app/settings/pricing-formulas")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Container className="p-8">
        <Heading level="h1">Loading...</Heading>
      </Container>
    )
  }

  return (
    <Container className="p-8 max-w-4xl">
      <div className="mb-6">
        <Button variant="transparent" onClick={() => navigate("/app/settings/pricing-formulas")} className="mb-4">
          ← Back to Formulas
        </Button>
        <Heading level="h1">Edit Pricing Formula</Heading>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="space-y-6">
        <div>
          <Label htmlFor="name">Name *</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Mat Pricing Formula" />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" rows={2} />
        </div>

        <div>
          <Label htmlFor="formula">Formula String *</Label>
          <Textarea id="formula" value={formulaString} onChange={(e) => setFormulaString(e.target.value)} rows={4} className="font-mono text-sm" />
          <p className="text-xs text-gray-500 mt-1">Variables: width_value, height_value, price_per_sqm</p>
        </div>

        <div>
          <Label htmlFor="active">Active Status</Label>
          <div className="flex items-center gap-2 mt-2">
            <Switch id="active" checked={isActive} onCheckedChange={setIsActive} />
            <span className="text-sm text-gray-600">{isActive ? "Active" : "Inactive"}</span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <Label>Parameters</Label>
            <Button variant="secondary" onClick={addParameter}>+ Add Parameter</Button>
          </div>

          <div className="space-y-2">
            {parameters.map((param, index) => (
              <div key={index} className="flex gap-2 items-center">
                <div className="flex-1">
                  <Input value={param.key} onChange={(e) => updateParameter(index, "key", e.target.value)} placeholder="Parameter name" className="font-mono text-sm" />
                </div>
                <div className="flex-1">
                  <Input type="number" step="any" value={param.value} onChange={(e) => updateParameter(index, "value", parseFloat(e.target.value) || 0)} placeholder="Value" />
                </div>
                <Button variant="transparent" onClick={() => removeParameter(index)}>
                  ×
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="secondary" onClick={() => navigate("/app/settings/pricing-formulas")} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={saveFormula} disabled={saving || !name || !formulaString}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </Container>
  )
}

export default EditPricingFormulaPage



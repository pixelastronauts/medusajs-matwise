import { Container, Heading, Button, Input, Textarea, Label } from "@medusajs/ui"
import { useNavigate } from "react-router-dom"
import { useState } from "react"
import { ArrowLeft, Plus, Trash } from "@medusajs/icons"

type Parameter = {
  key: string
  value: number
}

const CreatePricingFormulaPage = () => {
  const navigate = useNavigate()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [formulaString, setFormulaString] = useState("")
  const [parameters, setParameters] = useState<Parameter[]>([
    { key: "tax", value: 0.21 },
    { key: "base_profit", value: 47 },
    { key: "shipping_fee", value: 12 },
    { key: "additional_markup", value: 0.9 },
    { key: "base_rate_per_cm2", value: 0.00363 },
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationResult, setValidationResult] = useState<{
    valid: boolean
    error?: string
  } | null>(null)

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

  const validateFormula = async () => {
    try {
      const parametersObj = parameters.reduce((acc, param) => {
        if (param.key) {
          acc[param.key] = param.value
        }
        return acc
      }, {} as Record<string, number>)

      const response = await fetch("/admin/pricing-formulas", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "test-validation",
          formula_string: formulaString,
          parameters: parametersObj,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setValidationResult({ valid: true })
      } else {
        setValidationResult({ valid: false, error: data.error || "Invalid formula" })
      }
    } catch (err: any) {
      setValidationResult({ valid: false, error: err.message })
    }
  }

  const saveFormula = async () => {
    if (!name || !formulaString) {
      setError("Name and formula string are required")
      return
    }

    if (parameters.some((p) => !p.key)) {
      setError("All parameters must have a key")
      return
    }

    try {
      setSaving(true)
      setError(null)

      const parametersObj = parameters.reduce((acc, param) => {
        acc[param.key] = param.value
        return acc
      }, {} as Record<string, number>)

      const response = await fetch("/admin/pricing-formulas", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          formula_string: formulaString,
          parameters: parametersObj,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create pricing formula")
      }

      navigate("/pricing-formulas")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Container className="p-8 max-w-4xl">
      <div className="mb-6">
        <Button
          variant="transparent"
          onClick={() => navigate("/pricing-formulas")}
          className="mb-4"
        >
          <ArrowLeft className="mr-2" />
          Back to Formulas
        </Button>
        <Heading level="h1">Create Pricing Formula</Heading>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="space-y-6">
        <div>
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Mat Pricing Formula"
          />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description of the formula"
            rows={2}
          />
        </div>

        <div>
          <Label htmlFor="formula">Formula String *</Label>
          <Textarea
            id="formula"
            value={formulaString}
            onChange={(e) => setFormulaString(e.target.value)}
            placeholder="e.g., ((width_value * length_value * base_rate_per_cm2 + shipping_fee) * (additional_markup + 1) + base_profit) * (tax + 1)"
            rows={4}
            className="font-mono text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">
            Available variables: width_value, length_value, and any parameters defined below
          </p>
          <Button
            variant="secondary"
            onClick={validateFormula}
            className="mt-2"
            disabled={!formulaString}
          >
            Test Formula
          </Button>
          {validationResult && (
            <div
              className={`mt-2 p-2 rounded text-sm ${
                validationResult.valid
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {validationResult.valid
                ? "✓ Formula is valid"
                : `✗ ${validationResult.error}`}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <Label>Parameters</Label>
            <Button variant="secondary" onClick={addParameter}>
              <Plus className="mr-2" />
              Add Parameter
            </Button>
          </div>

          <div className="space-y-2">
            {parameters.map((param, index) => (
              <div key={index} className="flex gap-2 items-center">
                <div className="flex-1">
                  <Input
                    value={param.key}
                    onChange={(e) => updateParameter(index, "key", e.target.value)}
                    placeholder="Parameter name"
                    className="font-mono text-sm"
                  />
                </div>
                <div className="flex-1">
                  <Input
                    type="number"
                    step="any"
                    value={param.value}
                    onChange={(e) => updateParameter(index, "value", parseFloat(e.target.value) || 0)}
                    placeholder="Value"
                  />
                </div>
                <Button
                  variant="transparent"
                  onClick={() => removeParameter(index)}
                >
                  <Trash className="text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            variant="secondary"
            onClick={() => navigate("/pricing-formulas")}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={saveFormula}
            disabled={saving || !name || !formulaString}
          >
            {saving ? "Creating..." : "Create Formula"}
          </Button>
        </div>
      </div>

      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded">
        <h3 className="font-semibold mb-2">Example Formula:</h3>
        <code className="text-xs block bg-white p-2 rounded border">
          ((width_value * length_value * base_rate_per_cm2 + shipping_fee) * (additional_markup + 1) + base_profit) * (tax + 1)
        </code>
        <p className="text-sm text-gray-700 mt-2">
          This formula calculates price based on dimensions (cm²), adds shipping, applies markup, adds base profit, and includes tax.
        </p>
      </div>
    </Container>
  )
}

export default CreatePricingFormulaPage


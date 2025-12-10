import { Container, Heading, Button, Input, Textarea, Label, Switch } from "@medusajs/ui"
import { useNavigate, useParams } from "react-router-dom"
import { useState, useEffect } from "react"
import { ArrowLeft, Plus, Trash } from "@medusajs/icons"

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
  is_default: boolean
}

const EditPricingFormulaPage = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const [formula, setFormula] = useState<PricingFormula | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [formulaString, setFormulaString] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [isDefault, setIsDefault] = useState(false)
  const [parameters, setParameters] = useState<Parameter[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Preview/test state
  const [testWidth, setTestWidth] = useState(100)
  const [testHeight, setTestHeight] = useState(100)
  const [testPricePerSqm, setTestPricePerSqm] = useState(120)
  const [testResult, setTestResult] = useState<number | null>(null)
  const [testError, setTestError] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    fetchFormula()
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
      const formula = data.formula

      setFormula(formula)
      setName(formula.name)
      setDescription(formula.description || "")
      setFormulaString(formula.formula_string)
      setIsActive(formula.is_active)
      setIsDefault(formula.is_default || false)
      
      // Convert parameters object to array
      const paramArray = Object.entries(formula.parameters).map(([key, value]) => ({
        key,
        value: value as number,
      }))
      setParameters(paramArray)
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

  const testFormula = async () => {
    try {
      setTesting(true)
      setTestError(null)

      const response = await fetch(`/admin/pricing-formulas/${id}/calculate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variables: {
            width_value: testWidth,
            length_value: testHeight,
            price_per_sqm: testPricePerSqm,
          },
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to calculate price")
      }

      const data = await response.json()
      setTestResult(data.price)
    } catch (err: any) {
      setTestError(err.message)
      setTestResult(null)
    } finally {
      setTesting(false)
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
          is_default: isDefault,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to update pricing formula")
      }

      navigate("/pricing-formulas")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Container className="p-8">
        <Heading level="h1">Edit Pricing Formula</Heading>
        <p className="mt-4">Loading...</p>
      </Container>
    )
  }

  if (!formula) {
    return (
      <Container className="p-8">
        <Heading level="h1">Formula Not Found</Heading>
        <Button
          variant="secondary"
          onClick={() => navigate("/pricing-formulas")}
          className="mt-4"
        >
          <ArrowLeft className="mr-2" />
          Back to Formulas
        </Button>
      </Container>
    )
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
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Switch
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <Label>Active</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={isDefault}
              onCheckedChange={setIsDefault}
            />
            <Label>Default Formula</Label>
            {isDefault && <span className="text-yellow-600">★</span>}
          </div>
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

        {/* Formula Preview/Test Section */}
        <div className="border-t pt-6 mt-6">
          <Heading level="h2" className="mb-4">Test Formula</Heading>
          <p className="text-sm text-gray-600 mb-4">
            Test your formula with sample dimensions to see the calculated price
          </p>

          <div className="bg-gray-50 p-4 rounded-lg space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="testWidth">Width (cm)</Label>
                <Input
                  id="testWidth"
                  type="number"
                  value={testWidth}
                  onChange={(e) => setTestWidth(parseFloat(e.target.value) || 0)}
                  placeholder="100"
                />
              </div>
              <div>
                <Label htmlFor="testHeight">Height (cm)</Label>
                <Input
                  id="testHeight"
                  type="number"
                  value={testHeight}
                  onChange={(e) => setTestHeight(parseFloat(e.target.value) || 0)}
                  placeholder="100"
                />
              </div>
              <div>
                <Label htmlFor="testPricePerSqm">Price per m² (€)</Label>
                <Input
                  id="testPricePerSqm"
                  type="number"
                  step="0.01"
                  value={testPricePerSqm}
                  onChange={(e) => setTestPricePerSqm(parseFloat(e.target.value) || 0)}
                  placeholder="120"
                />
              </div>
            </div>

            <Button
              variant="secondary"
              onClick={testFormula}
              disabled={testing}
            >
              {testing ? "Calculating..." : "Calculate Price"}
            </Button>

            {testResult !== null && (
              <div className="bg-green-50 border border-green-200 p-4 rounded">
                <p className="text-sm text-gray-600 mb-1">Calculated Price:</p>
                <p className="text-2xl font-bold text-green-700">
                  €{testResult.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Dimensions: {testWidth}cm × {testHeight}cm ({((testWidth * testHeight) / 10000).toFixed(2)} m²)
                </p>
              </div>
            )}

            {testError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {testError}
              </div>
            )}
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
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </Container>
  )
}

export default EditPricingFormulaPage


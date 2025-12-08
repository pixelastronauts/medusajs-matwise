import { Container, Heading, Button, Input, Label, Select, Badge, Text } from "@medusajs/ui"
import { useNavigate } from "react-router-dom"
import { useState, useEffect, useCallback } from "react"
import { ArrowLeft, CheckCircleSolid, XCircleSolid, ArrowPath } from "@medusajs/icons"

type CompanyFormData = {
  name: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zip: string
  country: string
  logo_url: string
  currency_code: string
  vat_number: string
  vat_validated: boolean
  vat_country_code: string
  vat_company_name: string
  vat_company_address: string
  spending_limit_reset_frequency: "never" | "daily" | "weekly" | "monthly" | "yearly"
}

type VatValidationResult = {
  valid: boolean
  country?: string
  vatNumber?: string
  company?: string
  address?: string
  error?: string
}

const CreateCompanyPage = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<CompanyFormData>({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    country: "",
    logo_url: "",
    currency_code: "eur",
    vat_number: "",
    vat_validated: false,
    vat_country_code: "",
    vat_company_name: "",
    vat_company_address: "",
    spending_limit_reset_frequency: "monthly",
  })

  // VAT validation state
  const [vatValidating, setVatValidating] = useState(false)
  const [vatValidationResult, setVatValidationResult] = useState<VatValidationResult | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
    
    // Clear VAT validation when VAT number changes
    if (name === "vat_number") {
      setVatValidationResult(null)
      setFormData(prev => ({ ...prev, vat_validated: false }))
    }
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value })
  }

  // Validate VAT number
  const validateVat = useCallback(async () => {
    if (!formData.vat_number || formData.vat_number.length < 8) {
      setVatValidationResult({ valid: false, error: "VAT number must be at least 8 characters" })
      return
    }

    setVatValidating(true)
    try {
      const response = await fetch("/admin/validate-vat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vat_number: formData.vat_number }),
      })

      const data = await response.json()
      setVatValidationResult(data)
      
      if (data.valid) {
        setFormData(prev => ({ 
          ...prev, 
          vat_validated: true,
          vat_country_code: data.country || "",
          vat_company_name: data.company || "",
          vat_company_address: data.address || "",
          // Auto-fill company name if empty and VAT returns company name
          name: prev.name || data.company || prev.name,
        }))
      } else {
        setFormData(prev => ({ 
          ...prev, 
          vat_validated: false,
          vat_country_code: "",
          vat_company_name: "",
          vat_company_address: "",
        }))
      }
    } catch (err: any) {
      setVatValidationResult({ valid: false, error: "Failed to validate VAT" })
    } finally {
      setVatValidating(false)
    }
  }, [formData.vat_number])

  // Debounce VAT validation
  useEffect(() => {
    if (!formData.vat_number || formData.vat_number.length < 8) return

    const timeout = setTimeout(() => {
      validateVat()
    }, 800)

    return () => clearTimeout(timeout)
  }, [formData.vat_number, validateVat])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name || !formData.email) {
      setError("Name and email are required")
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await fetch("/admin/companies", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || "Failed to create company")
      }

      navigate("/companies")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container className="p-8 max-w-2xl">
      <Button
        variant="transparent"
        onClick={() => navigate("/companies")}
        className="mb-4"
      >
        <ArrowLeft className="mr-2" />
        Back to Companies
      </Button>

      <Heading level="h1" className="mb-6">Create Company</Heading>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label htmlFor="name">Company Name *</Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Acme Corp"
              required
            />
          </div>

          {/* VAT Number with validation */}
          <div className="col-span-2">
            <Label htmlFor="vat_number">VAT Number</Label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  id="vat_number"
                  name="vat_number"
                  value={formData.vat_number}
                  onChange={handleChange}
                  placeholder="NL123456789B01"
                />
                {/* Validation indicator */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {vatValidating && (
                    <ArrowPath className="w-4 h-4 animate-spin text-gray-400" />
                  )}
                  {!vatValidating && vatValidationResult?.valid && (
                    <CheckCircleSolid className="w-4 h-4 text-green-500" />
                  )}
                  {!vatValidating && vatValidationResult && !vatValidationResult.valid && formData.vat_number && (
                    <XCircleSolid className="w-4 h-4 text-red-500" />
                  )}
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={validateVat}
                disabled={vatValidating || !formData.vat_number}
                isLoading={vatValidating}
              >
                Validate
              </Button>
            </div>
            {/* Validation result message */}
            {vatValidationResult && (
              <div className="mt-2">
                {vatValidationResult.valid ? (
                  <div className="bg-green-50 border border-green-200 rounded p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge color="green" size="small">Valid</Badge>
                      {vatValidationResult.country && (
                        <Badge color="blue" size="small">{vatValidationResult.country}</Badge>
                      )}
                    </div>
                    {vatValidationResult.company && (
                      <Text className="text-sm font-medium text-gray-800">{vatValidationResult.company}</Text>
                    )}
                    {vatValidationResult.address && (
                      <Text className="text-sm text-gray-600">{vatValidationResult.address}</Text>
                    )}
                  </div>
                ) : vatValidationResult.error && formData.vat_number ? (
                  <Text className="text-sm text-red-500">{vatValidationResult.error}</Text>
                ) : null}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="contact@acme.com"
              required
            />
          </div>

          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+1 234 567 890"
            />
          </div>

          <div className="col-span-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="123 Main Street"
            />
          </div>

          <div>
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              name="city"
              value={formData.city}
              onChange={handleChange}
              placeholder="Amsterdam"
            />
          </div>

          <div>
            <Label htmlFor="state">State/Province</Label>
            <Input
              id="state"
              name="state"
              value={formData.state}
              onChange={handleChange}
              placeholder="North Holland"
            />
          </div>

          <div>
            <Label htmlFor="zip">Zip/Postal Code</Label>
            <Input
              id="zip"
              name="zip"
              value={formData.zip}
              onChange={handleChange}
              placeholder="1012 AB"
            />
          </div>

          <div>
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              name="country"
              value={formData.country}
              onChange={handleChange}
              placeholder="NL"
            />
          </div>

          <div>
            <Label htmlFor="currency_code">Currency</Label>
            <Select
              value={formData.currency_code}
              onValueChange={(value) => handleSelectChange("currency_code", value)}
            >
              <Select.Trigger>
                <Select.Value placeholder="Select currency" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="eur">EUR</Select.Item>
                <Select.Item value="usd">USD</Select.Item>
                <Select.Item value="gbp">GBP</Select.Item>
              </Select.Content>
            </Select>
          </div>

          <div>
            <Label htmlFor="spending_limit_reset_frequency">Spending Limit Reset</Label>
            <Select
              value={formData.spending_limit_reset_frequency}
              onValueChange={(value) => handleSelectChange("spending_limit_reset_frequency", value)}
            >
              <Select.Trigger>
                <Select.Value placeholder="Select frequency" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="never">Never</Select.Item>
                <Select.Item value="daily">Daily</Select.Item>
                <Select.Item value="weekly">Weekly</Select.Item>
                <Select.Item value="monthly">Monthly</Select.Item>
                <Select.Item value="yearly">Yearly</Select.Item>
              </Select.Content>
            </Select>
          </div>

          <div className="col-span-2">
            <Label htmlFor="logo_url">Logo URL</Label>
            <Input
              id="logo_url"
              name="logo_url"
              value={formData.logo_url}
              onChange={handleChange}
              placeholder="https://example.com/logo.png"
            />
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-4 border-t">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate("/companies")}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={loading}
          >
            Create Company
          </Button>
        </div>
      </form>
    </Container>
  )
}

export default CreateCompanyPage

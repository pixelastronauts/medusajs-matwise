import { Container, Heading, Button, Input, Label, Select, Badge, Table, Avatar, Text, Drawer, IconButton } from "@medusajs/ui"
import { useNavigate, useParams } from "react-router-dom"
import { useState, useEffect, useCallback } from "react"
import { ArrowLeft, Trash, Plus, User, MagnifyingGlass, XMark, CheckCircleSolid, XCircleSolid, ArrowPath } from "@medusajs/icons"

type Customer = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  has_account: boolean
  created_at: string
}

type Employee = {
  id: string
  customer_id: string
  role: "admin" | "member"
  spending_limit: number | null
  is_active: boolean
  created_at: string
  customer?: {
    id: string
    email: string
    first_name: string | null
    last_name: string | null
    has_account: boolean
  } | null
}

type Company = {
  id: string
  name: string
  email: string
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  country: string | null
  logo_url: string | null
  currency_code: string | null
  vat_number: string | null
  vat_validated: boolean
  vat_country_code: string | null
  vat_company_name: string | null
  vat_company_address: string | null
  vat_validated_at: string | null
  spending_limit_reset_frequency: "never" | "daily" | "weekly" | "monthly" | "yearly"
  employees?: Employee[]
  created_at: string
  updated_at: string
}

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

const CompanyDetailPage = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
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

  // Customer selection drawer state
  const [showCustomerDrawer, setShowCustomerDrawer] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customersLoading, setCustomersLoading] = useState(false)
  const [customerSearch, setCustomerSearch] = useState("")
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  
  // Add employee form state
  const [newEmployeeRole, setNewEmployeeRole] = useState<"admin" | "member">("member")
  const [newEmployeeSpendingLimit, setNewEmployeeSpendingLimit] = useState("")
  const [addingEmployee, setAddingEmployee] = useState(false)

  useEffect(() => {
    fetchCompany()
  }, [id])

  useEffect(() => {
    if (showCustomerDrawer) {
      fetchCustomers()
    }
  }, [showCustomerDrawer, customerSearch])

  const fetchCompany = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/admin/companies/${id}`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch company")
      }

      const data = await response.json()
      const comp = data.company
      setCompany(comp)
      setFormData({
        name: comp.name || "",
        email: comp.email || "",
        phone: comp.phone || "",
        address: comp.address || "",
        city: comp.city || "",
        state: comp.state || "",
        zip: comp.zip || "",
        country: comp.country || "",
        logo_url: comp.logo_url || "",
        currency_code: comp.currency_code || "eur",
        vat_number: comp.vat_number || "",
        vat_validated: comp.vat_validated || false,
        vat_country_code: comp.vat_country_code || "",
        vat_company_name: comp.vat_company_name || "",
        vat_company_address: comp.vat_company_address || "",
        spending_limit_reset_frequency: comp.spending_limit_reset_frequency || "monthly",
      })
      
      // Set initial VAT validation result if VAT is already validated
      if (comp.vat_number && comp.vat_validated) {
        setVatValidationResult({ 
          valid: true,
          country: comp.vat_country_code || undefined,
          company: comp.vat_company_name || undefined,
          address: comp.vat_company_address || undefined,
        })
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchCustomers = async () => {
    try {
      setCustomersLoading(true)
      
      const params = new URLSearchParams()
      if (customerSearch) {
        params.append("q", customerSearch)
      }
      params.append("limit", "50")
      
      const response = await fetch(`/admin/customers?${params.toString()}`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch customers")
      }

      const data = await response.json()
      setCustomers(data.customers || [])
    } catch (err: any) {
      console.error("Error fetching customers:", err)
    } finally {
      setCustomersLoading(false)
    }
  }

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name || !formData.email) {
      setError("Name and email are required")
      return
    }

    try {
      setSaving(true)
      setError(null)

      const response = await fetch(`/admin/companies/${id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || "Failed to update company")
      }

      await fetchCompany()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const addEmployee = async () => {
    if (!selectedCustomer) {
      alert("Please select a customer")
      return
    }

    try {
      setAddingEmployee(true)

      const response = await fetch(`/admin/companies/${id}/employees`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: selectedCustomer.id,
          role: newEmployeeRole,
          spending_limit: newEmployeeSpendingLimit ? Number(newEmployeeSpendingLimit) : null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || "Failed to add employee")
      }

      setSelectedCustomer(null)
      setNewEmployeeRole("member")
      setNewEmployeeSpendingLimit("")
      setShowCustomerDrawer(false)
      setCustomerSearch("")
      await fetchCompany()
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    } finally {
      setAddingEmployee(false)
    }
  }

  const removeEmployee = async (employeeId: string) => {
    if (!confirm("Are you sure you want to remove this employee?")) {
      return
    }

    try {
      const response = await fetch(`/admin/companies/${id}/employees/${employeeId}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) {
        throw new Error("Failed to remove employee")
      }

      await fetchCompany()
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    }
  }

  const updateEmployeeRole = async (employeeId: string, role: "admin" | "member") => {
    try {
      const response = await fetch(`/admin/companies/${id}/employees/${employeeId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      })

      if (!response.ok) {
        throw new Error("Failed to update employee")
      }

      await fetchCompany()
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    }
  }

  const isCustomerAlreadyEmployee = (customerId: string) => {
    return company?.employees?.some(e => e.customer_id === customerId) || false
  }

  const getCustomerName = (customer: Customer) => {
    if (customer.first_name || customer.last_name) {
      return `${customer.first_name || ""} ${customer.last_name || ""}`.trim()
    }
    return customer.email
  }

  if (loading) {
    return (
      <Container className="p-8">
        <Heading level="h1">Loading...</Heading>
      </Container>
    )
  }

  if (!company) {
    return (
      <Container className="p-8">
        <Heading level="h1">Company not found</Heading>
        <Button onClick={() => navigate("/companies")} className="mt-4">
          Back to Companies
        </Button>
      </Container>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <Button
        variant="transparent"
        onClick={() => navigate("/companies")}
      >
        <ArrowLeft className="mr-2" />
        Back to Companies
      </Button>

      {/* Company Details Form */}
      <Container className="p-6 max-w-2xl">
        <div className="flex items-center gap-4 mb-6">
          <Avatar
            src={company.logo_url || undefined}
            fallback={company.name.charAt(0).toUpperCase()}
            size="xlarge"
          />
          <div>
            <Heading level="h1">{company.name}</Heading>
            <Text className="text-gray-500">{company.id}</Text>
          </div>
        </div>

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
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
              />
            </div>

            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                name="city"
                value={formData.city}
                onChange={handleChange}
              />
            </div>

            <div>
              <Label htmlFor="state">State/Province</Label>
              <Input
                id="state"
                name="state"
                value={formData.state}
                onChange={handleChange}
              />
            </div>

            <div>
              <Label htmlFor="zip">Zip/Postal Code</Label>
              <Input
                id="zip"
                name="zip"
                value={formData.zip}
                onChange={handleChange}
              />
            </div>

            <div>
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                name="country"
                value={formData.country}
                onChange={handleChange}
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
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              isLoading={saving}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </Container>

      {/* Employees Section */}
      <Container className="p-6">
        <div className="flex items-center justify-between mb-4">
          <Heading level="h2">Employees</Heading>
          <Button
            variant="secondary"
            size="small"
            onClick={() => setShowCustomerDrawer(true)}
          >
            <Plus className="mr-2" />
            Add Employee
          </Button>
        </div>

        {company.employees && company.employees.length > 0 ? (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Customer</Table.HeaderCell>
                <Table.HeaderCell>Role</Table.HeaderCell>
                <Table.HeaderCell>Spending Limit</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Actions</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {company.employees.map((employee) => {
                const customerName = employee.customer
                  ? `${employee.customer.first_name || ""} ${employee.customer.last_name || ""}`.trim() || employee.customer.email
                  : employee.customer_id
                const customerEmail = employee.customer?.email
                
                return (
                <Table.Row key={employee.id}>
                  <Table.Cell>
                    <div className="flex items-center gap-3">
                      <Avatar fallback={customerName.charAt(0).toUpperCase()} />
                      <div>
                        <div className="font-medium">{customerName}</div>
                        {customerEmail && customerEmail !== customerName && (
                          <div className="text-sm text-gray-500">{customerEmail}</div>
                        )}
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Select
                      value={employee.role}
                      onValueChange={(value) => updateEmployeeRole(employee.id, value as "admin" | "member")}
                    >
                      <Select.Trigger className="w-32">
                        <Select.Value />
                      </Select.Trigger>
                      <Select.Content>
                        <Select.Item value="member">Member</Select.Item>
                        <Select.Item value="admin">Admin</Select.Item>
                      </Select.Content>
                    </Select>
                  </Table.Cell>
                  <Table.Cell>
                    {employee.spending_limit 
                      ? `${employee.spending_limit} ${company.currency_code?.toUpperCase() || ''}`
                      : "-"
                    }
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color={employee.is_active ? "green" : "grey"} size="small">
                      {employee.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <Button
                      variant="transparent"
                      onClick={() => removeEmployee(employee.id)}
                    >
                      <Trash className="text-red-500" />
                    </Button>
                  </Table.Cell>
                </Table.Row>
              )})}
            </Table.Body>
          </Table>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <User className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>No employees yet. Add customers to this company.</p>
          </div>
        )}
      </Container>

      {/* Customer Selection Drawer */}
      <Drawer open={showCustomerDrawer} onOpenChange={setShowCustomerDrawer}>
        <Drawer.Content className="max-w-lg">
          <Drawer.Header>
            <Drawer.Title>Add Employee</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="p-4 space-y-4">
            {/* Search */}
            <div>
              <Label>Search Customers</Label>
              <div className="relative">
                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Search by name or email..."
                  className="pl-10"
                />
              </div>
            </div>

            {/* Selected Customer */}
            {selectedCustomer && (
              <div className="bg-blue-50 border border-blue-200 rounded p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar fallback={getCustomerName(selectedCustomer).charAt(0).toUpperCase()} />
                  <div>
                    <div className="font-medium">{getCustomerName(selectedCustomer)}</div>
                    <div className="text-sm text-gray-500">{selectedCustomer.email}</div>
                  </div>
                </div>
                <IconButton variant="transparent" onClick={() => setSelectedCustomer(null)}>
                  <XMark className="w-4 h-4" />
                </IconButton>
              </div>
            )}

            {/* Customer List */}
            {!selectedCustomer && (
              <div className="border rounded max-h-64 overflow-y-auto">
                {customersLoading ? (
                  <div className="p-4 text-center text-gray-500">Loading customers...</div>
                ) : customers.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">No customers found</div>
                ) : (
                  customers.map((customer) => {
                    const isEmployee = isCustomerAlreadyEmployee(customer.id)
                    return (
                      <div
                        key={customer.id}
                        className={`p-3 flex items-center justify-between border-b last:border-b-0 ${
                          isEmployee 
                            ? "bg-gray-50 opacity-60" 
                            : "hover:bg-gray-50 cursor-pointer"
                        }`}
                        onClick={() => !isEmployee && setSelectedCustomer(customer)}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar fallback={getCustomerName(customer).charAt(0).toUpperCase()} />
                          <div>
                            <div className="font-medium">{getCustomerName(customer)}</div>
                            <div className="text-sm text-gray-500">{customer.email}</div>
                          </div>
                        </div>
                        {isEmployee ? (
                          <Badge color="green" size="small">
                            <CheckCircleSolid className="w-3 h-3 mr-1" />
                            Employee
                          </Badge>
                        ) : (
                          <Badge color={customer.has_account ? "blue" : "grey"} size="small">
                            {customer.has_account ? "Registered" : "Guest"}
                          </Badge>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            )}

            {/* Role and Spending Limit */}
            {selectedCustomer && (
              <div className="space-y-4 pt-4 border-t">
                <div>
                  <Label>Role</Label>
                  <Select
                    value={newEmployeeRole}
                    onValueChange={(value) => setNewEmployeeRole(value as "admin" | "member")}
                  >
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="member">Member</Select.Item>
                      <Select.Item value="admin">Admin</Select.Item>
                    </Select.Content>
                  </Select>
                </div>
                <div>
                  <Label>Spending Limit (optional)</Label>
                  <Input
                    type="number"
                    value={newEmployeeSpendingLimit}
                    onChange={(e) => setNewEmployeeSpendingLimit(e.target.value)}
                    placeholder="Leave empty for unlimited"
                  />
                </div>
              </div>
            )}
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close asChild>
              <Button variant="secondary">Cancel</Button>
            </Drawer.Close>
            <Button
              variant="primary"
              onClick={addEmployee}
              isLoading={addingEmployee}
              disabled={!selectedCustomer}
            >
              Add Employee
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </div>
  )
}

export default CompanyDetailPage

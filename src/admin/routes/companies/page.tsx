import { Container, Heading, Table, Button, Badge, Avatar, Text } from "@medusajs/ui"
import { useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"
import { PencilSquare, Trash, Plus, BuildingStorefront } from "@medusajs/icons"
import { defineRouteConfig } from "@medusajs/admin-sdk"

type Employee = {
  id: string
  customer_id: string
  role: "admin" | "member"
  spending_limit: number | null
  is_active: boolean
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
  spending_limit_reset_frequency: "never" | "daily" | "weekly" | "monthly" | "yearly"
  employees?: Employee[]
  created_at: string
  updated_at: string
}

const CompaniesPage = () => {
  const navigate = useNavigate()
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCompanies()
  }, [])

  const fetchCompanies = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch("/admin/companies", {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch companies")
      }

      const data = await response.json()
      setCompanies(data.companies || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const deleteCompany = async (id: string) => {
    if (!confirm("Are you sure you want to delete this company? All employees will be removed.")) {
      return
    }

    try {
      const response = await fetch(`/admin/companies/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) {
        throw new Error("Failed to delete company")
      }

      await fetchCompanies()
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    }
  }

  if (loading) {
    return (
      <Container className="p-8">
        <Heading level="h1">Companies</Heading>
        <p className="mt-4">Loading...</p>
      </Container>
    )
  }

  return (
    <Container className="p-8">
      <div className="flex items-center justify-between mb-6">
        <Heading level="h1">Companies</Heading>
        <Button
          variant="primary"
          onClick={() => navigate("/companies/create")}
        >
          <Plus className="mr-2" />
          Create Company
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {companies.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded p-8 text-center">
          <BuildingStorefront className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600 mb-4">
            No companies found. Create your first company to start managing B2B customers.
          </p>
          <Button
            variant="secondary"
            onClick={() => navigate("/companies/create")}
          >
            <Plus className="mr-2" />
            Create Company
          </Button>
        </div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell></Table.HeaderCell>
              <Table.HeaderCell>Name</Table.HeaderCell>
              <Table.HeaderCell>Email</Table.HeaderCell>
              <Table.HeaderCell>Phone</Table.HeaderCell>
              <Table.HeaderCell>Location</Table.HeaderCell>
              <Table.HeaderCell>Employees</Table.HeaderCell>
              <Table.HeaderCell>Currency</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Actions</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {companies.map((company) => (
              <Table.Row 
                key={company.id}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => navigate(`/companies/${company.id}`)}
              >
                <Table.Cell className="w-10">
                  <Avatar
                    src={company.logo_url || undefined}
                    fallback={company.name.charAt(0).toUpperCase()}
                  />
                </Table.Cell>
                <Table.Cell>
                  <div className="font-medium">{company.name}</div>
                </Table.Cell>
                <Table.Cell>
                  <span className="text-sm text-gray-600">
                    {company.email}
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <span className="text-sm text-gray-600">
                    {company.phone || "-"}
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <span className="text-sm text-gray-600">
                    {company.city && company.country
                      ? `${company.city}, ${company.country}`
                      : company.city || company.country || "-"}
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <Badge color="blue" size="small">
                    {company.employees?.length || 0} employees
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <span className="text-sm text-gray-600 uppercase">
                    {company.currency_code || "-"}
                  </span>
                </Table.Cell>
                <Table.Cell className="text-right">
                  <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="transparent"
                      onClick={() => navigate(`/companies/${company.id}`)}
                    >
                      <PencilSquare />
                    </Button>
                    <Button
                      variant="transparent"
                      onClick={() => deleteCompany(company.id)}
                    >
                      <Trash className="text-red-500" />
                    </Button>
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Companies",
  icon: BuildingStorefront,
})

export default CompaniesPage








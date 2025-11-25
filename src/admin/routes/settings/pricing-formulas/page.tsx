import React, { useState, useEffect } from "react"
import { Container, Heading, Table, Button, Badge } from "@medusajs/ui"
import { useNavigate } from "react-router-dom"
import { PencilSquare } from "@medusajs/icons"
import { defineRouteConfig } from "@medusajs/admin-sdk"

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

const PricingFormulasPage = () => {
  const navigate = useNavigate()
  const [formulas, setFormulas] = useState<PricingFormula[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchFormulas()
  }, [])

  const fetchFormulas = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch("/admin/pricing-formulas", {
        credentials: "include",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to fetch pricing formulas" }))
        throw new Error(errorData.message || "Failed to fetch pricing formulas")
      }

      const data = await response.json()
      setFormulas(Array.isArray(data.formulas) ? data.formulas : [])
    } catch (err: any) {
      console.error("Error fetching formulas:", err)
      setError(err.message || "An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  const deleteFormula = async (id: string) => {
    if (!confirm("Are you sure you want to delete this pricing formula?")) {
      return
    }

    try {
      const response = await fetch(`/admin/pricing-formulas/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to delete pricing formula" }))
        throw new Error(errorData.message || "Failed to delete pricing formula")
      }

      await fetchFormulas()
    } catch (err: any) {
      console.error("Error deleting formula:", err)
      alert(`Error: ${err.message || "Failed to delete pricing formula"}`)
    }
  }

  if (loading) {
    return (
      <Container className="p-8">
        <Heading level="h1">Pricing Formulas</Heading>
        <p className="mt-4">Loading...</p>
      </Container>
    )
  }

  return (
    <Container className="p-8">
      <div className="flex items-center justify-between mb-6">
        <Heading level="h1">Pricing Formulas</Heading>
        <Button
          variant="primary"
          onClick={() => navigate("/app/settings/pricing-formulas/create")}
        >
          + Create Formula
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {formulas.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded p-8 text-center">
          <p className="text-gray-600 mb-4">
            No pricing formulas found. Create your first formula to get started.
          </p>
          <Button
            variant="secondary"
            onClick={() => navigate("/app/settings/pricing-formulas/create")}
          >
            + Create Formula
          </Button>
        </div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Name</Table.HeaderCell>
              <Table.HeaderCell>Description</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Parameters</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Actions</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {formulas.map((formula) => (
              <Table.Row key={formula.id}>
                <Table.Cell>
                  <div className="font-medium">{formula.name}</div>
                  <div className="text-xs text-gray-500 font-mono mt-1">
                    {formula.formula_string.length > 50
                      ? formula.formula_string.substring(0, 50) + "..."
                      : formula.formula_string}
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <span className="text-sm text-gray-600">
                    {formula.description || "-"}
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <Badge
                    color={formula.is_active ? "green" : "grey"}
                    size="small"
                  >
                    {formula.is_active ? "Active" : "Inactive"}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <div className="text-xs space-y-1">
                    {formula.parameters && Object.entries(formula.parameters).slice(0, 2).map(([key, value]) => (
                      <div key={key} className="text-gray-600">
                        <span className="font-mono">{key}:</span> {value}
                      </div>
                    ))}
                    {formula.parameters && Object.keys(formula.parameters).length > 2 && (
                      <div className="text-gray-400">
                        +{Object.keys(formula.parameters).length - 2} more
                      </div>
                    )}
                    {(!formula.parameters || Object.keys(formula.parameters).length === 0) && (
                      <div className="text-gray-400">No parameters</div>
                    )}
                  </div>
                </Table.Cell>
                <Table.Cell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="transparent"
                      onClick={() => navigate(`/app/settings/pricing-formulas/${formula.id}`)}
                    >
                      <PencilSquare />
                    </Button>
                    <Button
                      variant="transparent"
                      onClick={() => deleteFormula(formula.id)}
                    >
                      ×
                    </Button>
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}

      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded">
        <h3 className="font-semibold mb-2">How to use pricing formulas:</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
          <li>Create a pricing formula with parameters and a formula string</li>
          <li>Attach the formula to a product using the product widget</li>
          <li>The formula will be used to calculate prices in the storefront</li>
          <li>Volume/bulk pricing tiers are still respected via multipliers</li>
        </ol>
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Pricing Formulas",
})

export default PricingFormulasPage


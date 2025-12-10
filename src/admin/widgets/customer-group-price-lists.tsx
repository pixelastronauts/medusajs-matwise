import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Badge, Table } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"

type PriceList = {
  id: string
  name: string
  type: string
  status: string
  tier_count: number
  variant_count: number
  priority: number
}

const CustomerGroupPriceListsWidget = () => {
  const { id: customerGroupId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [priceLists, setPriceLists] = useState<PriceList[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPriceLists = async () => {
      if (!customerGroupId) return

      try {
        setLoading(true)

        // Fetch all price lists
        const response = await fetch(`/admin/volume-pricing/price-lists`, {
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        })

        if (response.ok) {
          const data = await response.json()
          const allPriceLists = data.price_lists || []

          // Filter to only those that include this customer group
          const attachedPriceLists = allPriceLists.filter((pl: any) => {
            const groupIds = pl.customer_group_ids || []
            return groupIds.includes(customerGroupId)
          })

          setPriceLists(attachedPriceLists)
        }
      } catch (err) {
        console.error("Error fetching price lists:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchPriceLists()
  }, [customerGroupId])

  if (loading) {
    return (
      <Container className="p-4">
        <Text className="text-gray-500">Loading price lists...</Text>
      </Container>
    )
  }

  return (
    <Container className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <Heading level="h2" className="text-base">
          Volume Price Lists
        </Heading>
        <Badge color="grey" size="small">
          {priceLists.length} attached
        </Badge>
      </div>

      {priceLists.length === 0 ? (
        <div className="rounded border border-dashed border-gray-200 p-4 text-center">
          <Text className="text-sm text-gray-500">
            No volume price lists are assigned to this customer group.
          </Text>
          <Text className="mt-2 text-xs text-gray-400">
            Go to Volume Pricing to assign price lists with customer-specific pricing.
          </Text>
        </div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Name</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Tiers</Table.HeaderCell>
              <Table.HeaderCell>Variants</Table.HeaderCell>
              <Table.HeaderCell>Priority</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {priceLists.map((pl) => (
              <Table.Row
                key={pl.id}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => navigate(`/volume-pricing`)}
              >
                <Table.Cell>
                  <Text className="font-medium">{pl.name}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Badge color={pl.status === "active" ? "green" : "grey"} size="small">
                    {pl.status}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <Badge size="small" color="grey">
                    {pl.tier_count || 0}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <Badge size="small" color="grey">
                    {pl.variant_count || 0}
                  </Badge>
                </Table.Cell>
                <Table.Cell>{pl.priority}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "customer_group.details.after",
})

export default CustomerGroupPriceListsWidget


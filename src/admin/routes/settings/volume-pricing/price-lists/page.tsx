import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Container,
  Heading,
  Button,
  Input,
  Table,
  Badge,
  Text,
  Textarea,
  Select,
  Toaster,
  toast,
  FocusModal,
  Label,
  Switch,
} from "@medusajs/ui"
import { useEffect, useState } from "react"

type PriceList = {
  id: string
  name: string
  description: string | null
  type: "sale" | "override"
  status: "active" | "draft"
  starts_at: string | null
  ends_at: string | null
  customer_group_ids: string[]
  customer_ids: string[]
  priority: number
  created_at: string
}

type CustomerGroup = {
  id: string
  name: string
}

const PriceListsPage = () => {
  const [priceLists, setPriceLists] = useState<PriceList[]>([])
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingPriceList, setEditingPriceList] = useState<PriceList | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "override" as "sale" | "override",
    status: "draft" as "active" | "draft",
    starts_at: "",
    ends_at: "",
    customer_group_ids: [] as string[],
    priority: 0,
  })
  const [saving, setSaving] = useState(false)

  const fetchData = async () => {
    try {
      setLoading(true)

      // Fetch price lists
      const response = await fetch(`/admin/volume-pricing/price-lists`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })

      if (response.ok) {
        const data = await response.json()
        setPriceLists(data.price_lists || [])
      }

      // Fetch customer groups
      const groupsResponse = await fetch(`/admin/customer-groups`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })

      if (groupsResponse.ok) {
        const groupsData = await groupsResponse.json()
        setCustomerGroups(groupsData.customer_groups || [])
      }
    } catch (err: any) {
      toast.error("Error", { description: err.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      type: "override",
      status: "draft",
      starts_at: "",
      ends_at: "",
      customer_group_ids: [],
      priority: 0,
    })
  }

  const openCreateModal = () => {
    resetForm()
    setEditingPriceList(null)
    setShowCreateModal(true)
  }

  const openEditModal = (priceList: PriceList) => {
    setFormData({
      name: priceList.name,
      description: priceList.description || "",
      type: priceList.type,
      status: priceList.status,
      starts_at: priceList.starts_at ? priceList.starts_at.split("T")[0] : "",
      ends_at: priceList.ends_at ? priceList.ends_at.split("T")[0] : "",
      customer_group_ids: priceList.customer_group_ids || [],
      priority: priceList.priority,
    })
    setEditingPriceList(priceList)
    setShowCreateModal(true)
  }

  const closeModal = () => {
    setShowCreateModal(false)
    setEditingPriceList(null)
    resetForm()
  }

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error("Validation", { description: "Name is required" })
      return
    }

    try {
      setSaving(true)

      const payload = {
        name: formData.name,
        description: formData.description || null,
        type: formData.type,
        status: formData.status,
        starts_at: formData.starts_at || null,
        ends_at: formData.ends_at || null,
        customer_group_ids: formData.customer_group_ids,
        priority: formData.priority,
      }

      let response: Response

      if (editingPriceList) {
        // Update
        response = await fetch(`/admin/volume-pricing/price-lists/${editingPriceList.id}`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      } else {
        // Create
        response = await fetch(`/admin/volume-pricing/price-lists`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      }

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to save")
      }

      toast.success("Success", {
        description: editingPriceList ? "Price list updated" : "Price list created",
      })

      closeModal()
      await fetchData()
    } catch (err: any) {
      toast.error("Error", { description: err.message })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (priceList: PriceList) => {
    if (!confirm(`Are you sure you want to delete "${priceList.name}"? This will also delete all associated pricing tiers.`)) {
      return
    }

    try {
      const response = await fetch(`/admin/volume-pricing/price-lists/${priceList.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to delete")
      }

      toast.success("Deleted", { description: "Price list deleted successfully" })
      await fetchData()
    } catch (err: any) {
      toast.error("Error", { description: err.message })
    }
  }

  const toggleStatus = async (priceList: PriceList) => {
    const newStatus = priceList.status === "active" ? "draft" : "active"

    try {
      const response = await fetch(`/admin/volume-pricing/price-lists/${priceList.id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        throw new Error("Failed to update status")
      }

      toast.success("Updated", { description: `Price list is now ${newStatus}` })
      await fetchData()
    } catch (err: any) {
      toast.error("Error", { description: err.message })
    }
  }

  const toggleCustomerGroup = (groupId: string) => {
    setFormData((prev) => {
      const ids = prev.customer_group_ids.includes(groupId)
        ? prev.customer_group_ids.filter((id) => id !== groupId)
        : [...prev.customer_group_ids, groupId]
      return { ...prev, customer_group_ids: ids }
    })
  }

  if (loading) {
    return (
      <Container className="p-6">
        <div className="flex items-center justify-center py-12">
          <Text>Loading price lists...</Text>
        </div>
      </Container>
    )
  }

  return (
    <Container className="p-6">
      <Toaster />

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Heading level="h1" className="text-xl">
            Volume Price Lists
          </Heading>
          <Text className="text-gray-600">
            Create price lists to offer different volume pricing to customer groups
          </Text>
        </div>
        <Button onClick={openCreateModal}>Create Price List</Button>
      </div>

      {/* Price Lists Table */}
      {priceLists.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
          <Text className="text-gray-500">No price lists yet</Text>
          <Text className="mt-2 text-sm text-gray-400">
            Create a price list to offer different pricing to customer groups
          </Text>
          <Button className="mt-4" onClick={openCreateModal}>
            Create Your First Price List
          </Button>
        </div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Name</Table.HeaderCell>
              <Table.HeaderCell>Type</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Customer Groups</Table.HeaderCell>
              <Table.HeaderCell>Priority</Table.HeaderCell>
              <Table.HeaderCell>Actions</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {priceLists.map((pl) => (
              <Table.Row key={pl.id}>
                <Table.Cell>
                  <div>
                    <Text className="font-medium">{pl.name}</Text>
                    {pl.description && (
                      <Text className="text-sm text-gray-500">{pl.description}</Text>
                    )}
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <Badge color={pl.type === "sale" ? "purple" : "blue"}>{pl.type}</Badge>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={pl.status === "active"}
                      onCheckedChange={() => toggleStatus(pl)}
                    />
                    <Badge color={pl.status === "active" ? "green" : "grey"}>{pl.status}</Badge>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  {pl.customer_group_ids.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {pl.customer_group_ids.map((gid) => {
                        const group = customerGroups.find((g) => g.id === gid)
                        return (
                          <Badge key={gid} size="small" color="grey">
                            {group?.name || gid}
                          </Badge>
                        )
                      })}
                    </div>
                  ) : (
                    <Text className="text-sm text-gray-400">No groups assigned</Text>
                  )}
                </Table.Cell>
                <Table.Cell>{pl.priority}</Table.Cell>
                <Table.Cell>
                  <div className="flex items-center gap-2">
                    <Button variant="transparent" size="small" onClick={() => openEditModal(pl)}>
                      Edit
                    </Button>
                    <Button
                      variant="transparent"
                      size="small"
                      className="text-red-600"
                      onClick={() => handleDelete(pl)}
                    >
                      Delete
                    </Button>
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}

      {/* Create/Edit Modal */}
      <FocusModal open={showCreateModal} onOpenChange={setShowCreateModal}>
        <FocusModal.Content>
          <FocusModal.Header>
            <Heading level="h2">
              {editingPriceList ? "Edit Price List" : "Create Price List"}
            </Heading>
          </FocusModal.Header>
          <FocusModal.Body className="p-6">
            <div className="space-y-6">
              {/* Name */}
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., B2B Pricing, VIP Customers"
                />
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>

              {/* Type */}
              <div>
                <Label>Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, type: value as "sale" | "override" })
                  }
                >
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="override">Override (replaces default prices)</Select.Item>
                    <Select.Item value="sale">Sale (temporary discount)</Select.Item>
                  </Select.Content>
                </Select>
              </div>

              {/* Status */}
              <div className="flex items-center gap-3">
                <Switch
                  id="status"
                  checked={formData.status === "active"}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, status: checked ? "active" : "draft" })
                  }
                />
                <Label htmlFor="status">Active</Label>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="starts_at">Starts At</Label>
                  <Input
                    id="starts_at"
                    type="date"
                    value={formData.starts_at}
                    onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="ends_at">Ends At</Label>
                  <Input
                    id="ends_at"
                    type="date"
                    value={formData.ends_at}
                    onChange={(e) => setFormData({ ...formData, ends_at: e.target.value })}
                  />
                </div>
              </div>

              {/* Priority */}
              <div>
                <Label htmlFor="priority">Priority (higher = takes precedence)</Label>
                <Input
                  id="priority"
                  type="number"
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })
                  }
                />
              </div>

              {/* Customer Groups */}
              <div>
                <Label>Customer Groups</Label>
                <Text className="mb-2 text-sm text-gray-500">
                  Select which customer groups should get this pricing
                </Text>
                {customerGroups.length === 0 ? (
                  <div className="rounded border border-dashed border-gray-300 p-4 text-center">
                    <Text className="text-sm text-gray-500">
                      No customer groups found. Create customer groups first to assign them here.
                    </Text>
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto rounded border border-gray-200">
                    {customerGroups.map((group) => (
                      <div
                        key={group.id}
                        className={`flex cursor-pointer items-center gap-3 border-b border-gray-100 p-3 last:border-b-0 ${
                          formData.customer_group_ids.includes(group.id)
                            ? "bg-blue-50"
                            : "hover:bg-gray-50"
                        }`}
                        onClick={() => toggleCustomerGroup(group.id)}
                      >
                        <input
                          type="checkbox"
                          checked={formData.customer_group_ids.includes(group.id)}
                          onChange={() => {}}
                          className="rounded"
                        />
                        <span>{group.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </FocusModal.Body>
          <FocusModal.Footer>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={closeModal}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? "Saving..." : editingPriceList ? "Update" : "Create"}
              </Button>
            </div>
          </FocusModal.Footer>
        </FocusModal.Content>
      </FocusModal>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Volume Price Lists",
})

export default PriceListsPage


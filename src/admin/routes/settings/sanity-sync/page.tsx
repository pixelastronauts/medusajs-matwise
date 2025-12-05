import React, { useState, useEffect } from "react"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Container,
  Button,
  Heading,
  Text,
  Badge,
  Table,
  Toaster,
  toast,
} from "@medusajs/ui"
import { ArrowPath, CheckCircle, XCircle, ExclamationCircle, Clock } from "@medusajs/icons"

type SyncStatus = {
  id: string
  title: string
  handle: string
  medusa_updated_at: string
  sanity_synced_at: string | null
  status: "synced" | "out_of_sync" | "missing_in_sanity"
  variants_count: number
  variants_synced: number
}

type SyncSummary = {
  total: number
  synced: number
  out_of_sync: number
  missing_in_sanity: number
  sync_percentage: number
}

type WorkflowExecution = {
  id: string
  workflow_id: string
  state: string
  created_at: string
  updated_at: string
}

const SanitySyncPage = () => {
  const [summary, setSummary] = useState<SyncSummary | null>(null)
  const [products, setProducts] = useState<SyncStatus[]>([])
  const [executions, setExecutions] = useState<WorkflowExecution[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [filter, setFilter] = useState<"all" | "issues">("issues")

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      const [statusRes, executionsRes] = await Promise.all([
        fetch("/admin/sanity/syncs/status", {
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        }),
        fetch("/admin/sanity/syncs", {
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        }),
      ])

      if (statusRes.ok) {
        const data = await statusRes.json()
        setSummary(data.summary)
        setProducts(data.products)
      }

      if (executionsRes.ok) {
        const data = await executionsRes.json()
        setExecutions(data.workflow_executions?.slice(0, 10) || [])
      }
    } catch (error) {
      console.error("Error fetching sync status:", error)
      toast.error("Failed to load sync status")
    } finally {
      setLoading(false)
    }
  }

  const triggerSync = async (type: "products" | "collections" | "all") => {
    try {
      setSyncing(true)
      toast.info(`Starting ${type} sync...`)

      const response = await fetch("/admin/sanity/syncs", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      })

      if (response.ok) {
        toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} sync started successfully!`)
        // Wait a moment then refresh
        setTimeout(() => fetchData(), 2000)
      } else {
        const error = await response.json()
        toast.error(error.message || "Failed to start sync")
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to start sync")
    } finally {
      setSyncing(false)
    }
  }

  const syncSingleProduct = async (productId: string) => {
    try {
      toast.info("Syncing product...")

      const response = await fetch(`/admin/sanity/documents/${productId}/sync`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })

      if (response.ok) {
        toast.success("Product synced successfully!")
        await fetchData()
      } else {
        toast.error("Failed to sync product")
      }
    } catch (error) {
      toast.error("Failed to sync product")
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "synced":
        return (
          <Badge color="green" size="small">
            <CheckCircle className="w-3 h-3 mr-1" />
            Synced
          </Badge>
        )
      case "out_of_sync":
        return (
          <Badge color="orange" size="small">
            <ExclamationCircle className="w-3 h-3 mr-1" />
            Out of Sync
          </Badge>
        )
      case "missing_in_sanity":
        return (
          <Badge color="red" size="small">
            <XCircle className="w-3 h-3 mr-1" />
            Missing
          </Badge>
        )
      default:
        return <Badge color="grey" size="small">Unknown</Badge>
    }
  }

  const filteredProducts =
    filter === "issues"
      ? products.filter((p) => p.status !== "synced")
      : products

  if (loading) {
    return (
      <Container className="p-8">
        <div className="flex items-center gap-2 mb-6">
          <ArrowPath className="animate-spin" />
          <Heading level="h1">Loading Sanity Sync Status...</Heading>
        </div>
      </Container>
    )
  }

  return (
    <Container className="p-8">
      <Toaster />

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Heading level="h1">Sanity CMS Sync</Heading>
          <Text className="text-gray-500 mt-1">
            Monitor and manage synchronization between Medusa and Sanity CMS
          </Text>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={fetchData} disabled={syncing}>
            <ArrowPath className={`mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="primary"
            onClick={() => triggerSync("all")}
            disabled={syncing}
          >
            {syncing ? (
              <>
                <ArrowPath className="mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <ArrowPath className="mr-2" />
                Sync All
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border rounded-lg p-4">
            <Text className="text-gray-500 text-sm">Total Products</Text>
            <Heading level="h2" className="text-2xl mt-1">
              {summary.total}
            </Heading>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <Text className="text-gray-500 text-sm">Synced</Text>
            <Heading level="h2" className="text-2xl mt-1 text-green-600">
              {summary.synced}
            </Heading>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <Text className="text-gray-500 text-sm">Out of Sync</Text>
            <Heading level="h2" className="text-2xl mt-1 text-orange-600">
              {summary.out_of_sync}
            </Heading>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <Text className="text-gray-500 text-sm">Missing in Sanity</Text>
            <Heading level="h2" className="text-2xl mt-1 text-red-600">
              {summary.missing_in_sanity}
            </Heading>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {summary && (
        <div className="bg-white border rounded-lg p-4 mb-8">
          <div className="flex justify-between items-center mb-2">
            <Text className="font-medium">Sync Progress</Text>
            <Text className="text-gray-500">{summary.sync_percentage}% synced</Text>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${summary.sync_percentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white border rounded-lg p-4 mb-8">
        <Heading level="h2" className="mb-4">Quick Actions</Heading>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="secondary"
            size="small"
            onClick={() => triggerSync("products")}
            disabled={syncing}
          >
            Sync Products Only
          </Button>
          <Button
            variant="secondary"
            size="small"
            onClick={() => triggerSync("collections")}
            disabled={syncing}
          >
            Sync Collections Only
          </Button>
          {summary && summary.missing_in_sanity + summary.out_of_sync > 0 && (
            <Button
              variant="primary"
              size="small"
              onClick={() => triggerSync("all")}
              disabled={syncing}
            >
              Fix {summary.missing_in_sanity + summary.out_of_sync} Issues
            </Button>
          )}
        </div>
      </div>

      {/* Recent Sync History */}
      {executions.length > 0 && (
        <div className="bg-white border rounded-lg p-4 mb-8">
          <Heading level="h2" className="mb-4">Recent Sync History</Heading>
          <div className="space-y-2">
            {executions.slice(0, 5).map((exec) => (
              <div
                key={exec.id}
                className="flex items-center justify-between text-sm py-2 border-b last:border-0"
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <Text className="font-mono text-xs">
                    {exec.workflow_id.replace("sanity-sync-", "")}
                  </Text>
                </div>
                <div className="flex items-center gap-4">
                  <Badge
                    color={
                      exec.state === "completed"
                        ? "green"
                        : exec.state === "failed"
                        ? "red"
                        : "blue"
                    }
                    size="small"
                  >
                    {exec.state}
                  </Badge>
                  <Text className="text-gray-400 text-xs">
                    {new Date(exec.created_at).toLocaleString()}
                  </Text>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Product Status Table */}
      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <Heading level="h2">Product Sync Status</Heading>
          <div className="flex gap-2">
            <Button
              variant={filter === "issues" ? "primary" : "secondary"}
              size="small"
              onClick={() => setFilter("issues")}
            >
              Issues Only ({products.filter((p) => p.status !== "synced").length})
            </Button>
            <Button
              variant={filter === "all" ? "primary" : "secondary"}
              size="small"
              onClick={() => setFilter("all")}
            >
              All ({products.length})
            </Button>
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <Heading level="h3" className="text-green-600">
              All Products Synced!
            </Heading>
            <Text className="text-gray-500 mt-2">
              Everything is in sync between Medusa and Sanity.
            </Text>
          </div>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Product</Table.HeaderCell>
                <Table.HeaderCell>Handle</Table.HeaderCell>
                <Table.HeaderCell>Variants</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell>Last Synced</Table.HeaderCell>
                <Table.HeaderCell>Actions</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {filteredProducts.map((product) => (
                <Table.Row key={product.id}>
                  <Table.Cell>
                    <a
                      href={`/products/${product.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {product.title}
                    </a>
                  </Table.Cell>
                  <Table.Cell className="font-mono text-xs text-gray-500">
                    {product.handle}
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-sm">
                      {product.variants_synced}/{product.variants_count}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>{getStatusBadge(product.status)}</Table.Cell>
                  <Table.Cell className="text-xs text-gray-500">
                    {product.sanity_synced_at
                      ? new Date(product.sanity_synced_at).toLocaleString()
                      : "Never"}
                  </Table.Cell>
                  <Table.Cell>
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => syncSingleProduct(product.id)}
                    >
                      <ArrowPath className="w-3 h-3 mr-1" />
                      Sync
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Sanity Sync",
  icon: ArrowPath,
})

export default SanitySyncPage


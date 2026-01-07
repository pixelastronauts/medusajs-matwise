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
  Checkbox,
} from "@medusajs/ui"
import { ArrowPath, CheckCircle, XCircle, ExclamationCircle, CircleStack } from "@medusajs/icons"

type TableInfo = {
  name: string
  row_count: number
  size: string
  selected: boolean
}

type SyncStatus = {
  status: "idle" | "syncing" | "completed" | "error"
  current_table?: string
  tables_synced: number
  total_tables: number
  error?: string
  progress: number
}

type TableGroup = {
  name: string
  label: string
  description: string
  tables: string[]
  color: "blue" | "green" | "purple" | "orange" | "red"
}

const TABLE_GROUPS: TableGroup[] = [
  {
    name: "products",
    label: "Products",
    description: "Products, variants, options, pricing",
    tables: [
      "product",
      "product_variant",
      "product_option",
      "product_option_value",
      "product_category",
      "product_category_product",
      "product_collection",
      "product_tag",
      "product_tags",
      "product_type",
      "product_sales_channel",
      "product_shipping_profile",
      "product_variant_inventory_item",
      "product_variant_option",
      "product_variant_price_set",
      "image",
      "price",
      "price_set",
      "price_preference",
      "price_rule",
      "price_list",
      "price_list_rule",
      "pricing_formula",
    ],
    color: "blue",
  },
  {
    name: "orders",
    label: "Orders",
    description: "Orders, fulfillments, returns",
    tables: [
      "order",
      "order_address",
      "order_cart",
      "order_change",
      "order_change_action",
      "order_claim",
      "order_claim_item",
      "order_claim_item_image",
      "order_exchange",
      "order_exchange_item",
      "order_fulfillment",
      "order_item",
      "order_line_item",
      "order_line_item_adjustment",
      "order_line_item_tax_line",
      "order_payment_collection",
      "order_promotion",
      "order_shipping",
      "order_shipping_method",
      "order_shipping_method_adjustment",
      "order_shipping_method_tax_line",
      "order_summary",
      "order_transaction",
      "order_credit_line",
      "fulfillment",
      "fulfillment_address",
      "fulfillment_item",
      "fulfillment_label",
      "fulfillment_set",
      "return",
      "return_fulfillment",
      "return_item",
      "return_reason",
      "refund",
      "refund_reason",
    ],
    color: "green",
  },
  {
    name: "customers",
    label: "Customers",
    description: "Customers, addresses, groups",
    tables: [
      "customer",
      "customer_address",
      "customer_group",
      "customer_group_customer",
      "customer_account_holder",
    ],
    color: "purple",
  },
  {
    name: "promotions",
    label: "Promotions",
    description: "Promotions, campaigns, rules",
    tables: [
      "promotion",
      "promotion_application_method",
      "promotion_campaign",
      "promotion_campaign_budget",
      "promotion_promotion_rule",
      "promotion_rule",
      "promotion_rule_value",
      "cart_promotion",
      "order_promotion",
      "application_method_buy_rules",
      "application_method_target_rules",
    ],
    color: "orange",
  },
  {
    name: "settings",
    label: "Settings",
    description: "Regions, shipping, tax, payments",
    tables: [
      "region",
      "region_country",
      "region_payment_provider",
      "currency",
      "store",
      "store_currency",
      "sales_channel",
      "sales_channel_stock_location",
      "publishable_api_key_sales_channel",
      "tax_provider",
      "tax_rate",
      "tax_rate_rule",
      "tax_region",
      "geo_zone",
      "shipping_option",
      "shipping_option_price_set",
      "shipping_option_rule",
      "shipping_option_type",
      "shipping_profile",
      "service_zone",
      "fulfillment_provider",
      "location_fulfillment_provider",
      "location_fulfillment_set",
      "payment_provider",
      "payment_collection_payment_providers",
      "stock_location",
      "stock_location_address",
    ],
    color: "red",
  },
]

const DatabaseSyncPage = () => {
  const [tables, setTables] = useState<TableInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    status: "idle",
    tables_synced: 0,
    total_tables: 0,
    progress: 0,
  })
  const [isDevelopment, setIsDevelopment] = useState(false)
  const [selectAll, setSelectAll] = useState(false)

  useEffect(() => {
    fetchTables()
  }, [])

  const fetchTables = async () => {
    try {
      setLoading(true)

      const response = await fetch("/admin/database-sync/tables", {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })

      if (response.ok) {
        const data = await response.json()
        setTables(data.tables.map((t: TableInfo) => ({ ...t, selected: false })))
        setIsDevelopment(data.is_development)
      } else {
        const error = await response.json()
        toast.error(error.message || "Failed to load tables")
      }
    } catch (error) {
      console.error("Error fetching tables:", error)
      toast.error("Failed to load database information")
    } finally {
      setLoading(false)
    }
  }

  const toggleTable = (tableName: string) => {
    setTables((prev) =>
      prev.map((t) => (t.name === tableName ? { ...t, selected: !t.selected } : t))
    )
  }

  const toggleSelectAll = () => {
    const newSelectAll = !selectAll
    setSelectAll(newSelectAll)
    setTables((prev) => prev.map((t) => ({ ...t, selected: newSelectAll })))
  }

  const selectGroup = (group: TableGroup) => {
    setTables((prev) =>
      prev.map((t) => ({
        ...t,
        selected: group.tables.includes(t.name) ? true : t.selected,
      }))
    )
    toast.success(`Selected ${group.label} tables`)
  }

  const deselectAll = () => {
    setSelectAll(false)
    setTables((prev) => prev.map((t) => ({ ...t, selected: false })))
  }

  const syncDatabase = async (syncType: "all" | "selected") => {
    const tablesToSync = syncType === "all" 
      ? tables.map(t => t.name)
      : tables.filter(t => t.selected).map(t => t.name)

    if (tablesToSync.length === 0) {
      toast.error("Please select at least one table to sync")
      return
    }

    try {
      setSyncStatus({
        status: "syncing",
        tables_synced: 0,
        total_tables: tablesToSync.length,
        progress: 0,
      })

      toast.info(`Starting sync of ${tablesToSync.length} table${tablesToSync.length > 1 ? 's' : ''}...`)

      const response = await fetch("/admin/database-sync", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          tables: tablesToSync,
          anonymize: true, // Always anonymize for safety
        }),
      })

      if (response.ok) {
        const data = await response.json()
        
        setSyncStatus({
          status: "completed",
          tables_synced: data.tables_synced,
          total_tables: data.total_tables,
          progress: 100,
        })

        toast.success(`Successfully synced ${data.tables_synced} table${data.tables_synced > 1 ? 's' : ''}!`)
        
        // Refresh table info
        setTimeout(() => fetchTables(), 2000)
      } else {
        const error = await response.json()
        setSyncStatus({
          status: "error",
          tables_synced: 0,
          total_tables: tablesToSync.length,
          progress: 0,
          error: error.message,
        })
        toast.error(error.message || "Failed to sync database")
      }
    } catch (error: any) {
      setSyncStatus({
        status: "error",
        tables_synced: 0,
        total_tables: tablesToSync.length,
        progress: 0,
        error: error.message,
      })
      toast.error(error.message || "Failed to sync database")
    }
  }

  const selectedCount = tables.filter((t) => t.selected).length

  if (loading) {
    return (
      <Container className="p-8">
        <div className="flex items-center gap-2 mb-6">
          <ArrowPath className="animate-spin" />
          <Heading level="h1">Loading Database Information...</Heading>
        </div>
      </Container>
    )
  }

  if (!isDevelopment) {
    return (
      <Container className="p-8">
        <Toaster />
        <div className="flex items-center gap-3 mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <ExclamationCircle className="w-6 h-6 text-red-600" />
          <div>
            <Heading level="h2" className="text-red-900">Production Environment Detected</Heading>
            <Text className="text-red-700 mt-1">
              Database sync is only available in development environments for safety reasons.
            </Text>
          </div>
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
          <div className="flex items-center gap-3 mb-2">
            <CircleStack className="w-8 h-8 text-blue-600" />
            <Heading level="h1">Database Sync</Heading>
          </div>
          <Text className="text-gray-500">
            Sync data from production to your local development database
          </Text>
          <Badge color="green" size="small" className="mt-2">
            Development Mode
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={fetchTables} disabled={syncStatus.status === "syncing"}>
            <ArrowPath className={`mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Warning Banner */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8">
        <div className="flex items-start gap-3">
          <ExclamationCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
          <div>
            <Heading level="h3" className="text-sm text-yellow-900 mb-1">
              Important Notes
            </Heading>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• This will overwrite your local database with production data</li>
              <li>• Customer emails and sensitive data will be anonymized automatically</li>
              <li>• File uploads (images, etc.) are not synced - only database records</li>
              <li>• Make sure you have a backup if needed</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Sync Progress */}
      {syncStatus.status === "syncing" && (
        <div className="bg-white border rounded-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <Heading level="h2" className="mb-1">Syncing Database...</Heading>
              <Text className="text-gray-500 text-sm">
                {syncStatus.current_table ? `Syncing: ${syncStatus.current_table}` : "Preparing..."}
              </Text>
            </div>
            <Badge color="blue" size="small">
              <ArrowPath className="w-3 h-3 mr-1 animate-spin" />
              {syncStatus.tables_synced} / {syncStatus.total_tables} tables
            </Badge>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${syncStatus.progress}%` }}
            />
          </div>
          <Text className="text-xs text-gray-400">
            Please don't close this page while syncing...
          </Text>
        </div>
      )}

      {/* Sync Result */}
      {syncStatus.status === "completed" && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-8">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <div>
              <Heading level="h3" className="text-green-900">Sync Completed!</Heading>
              <Text className="text-green-700 mt-1">
                Successfully synced {syncStatus.tables_synced} table{syncStatus.tables_synced !== 1 ? 's' : ''} from production.
              </Text>
            </div>
          </div>
        </div>
      )}

      {syncStatus.status === "error" && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
          <div className="flex items-center gap-3">
            <XCircle className="w-6 h-6 text-red-600" />
            <div>
              <Heading level="h3" className="text-red-900">Sync Failed</Heading>
              <Text className="text-red-700 mt-1">{syncStatus.error}</Text>
            </div>
          </div>
        </div>
      )}

      {/* Quick Select Groups */}
      <div className="bg-white border rounded-lg p-6 mb-8">
        <Heading level="h2" className="mb-4">Quick Select</Heading>
        <Text className="text-gray-500 text-sm mb-4">
          Select common groups of tables to sync
        </Text>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
          {TABLE_GROUPS.map((group) => (
            <button
              key={group.name}
              onClick={() => selectGroup(group)}
              disabled={syncStatus.status === "syncing"}
              className={`
                p-4 border-2 rounded-lg text-left transition-all
                hover:border-${group.color}-500 hover:bg-${group.color}-50
                disabled:opacity-50 disabled:cursor-not-allowed
                border-gray-200
              `}
            >
              <div className={`font-medium text-${group.color}-900 mb-1`}>
                {group.label}
              </div>
              <div className="text-xs text-gray-500">
                {group.description}
              </div>
              <div className="text-xs text-gray-400 mt-2">
                {group.tables.length} tables
              </div>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="small"
            onClick={deselectAll}
            disabled={syncStatus.status === "syncing"}
          >
            <XCircle className="mr-1" />
            Clear Selection
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white border rounded-lg p-6 mb-8">
        <Heading level="h2" className="mb-4">Sync Actions</Heading>
        <div className="flex gap-3">
          <Button
            variant="primary"
            onClick={() => syncDatabase("all")}
            disabled={syncStatus.status === "syncing"}
          >
            {syncStatus.status === "syncing" ? (
              <>
                <ArrowPath className="mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <CircleStack className="mr-2" />
                Sync All Tables ({tables.length})
              </>
            )}
          </Button>
          <Button
            variant="secondary"
            onClick={() => syncDatabase("selected")}
            disabled={syncStatus.status === "syncing" || selectedCount === 0}
          >
            <CheckCircle className="mr-2" />
            Sync Selected ({selectedCount})
          </Button>
        </div>
      </div>

      {/* Tables List */}
      <div className="bg-white border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <Heading level="h2">Available Tables</Heading>
          <div className="flex items-center gap-2">
            <Checkbox
              id="select-all"
              checked={selectAll}
              onCheckedChange={toggleSelectAll}
            />
            <label htmlFor="select-all" className="text-sm cursor-pointer">
              Select All
            </label>
          </div>
        </div>

        {tables.length === 0 ? (
          <div className="text-center py-8">
            <CircleStack className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <Text className="text-gray-500">No tables found</Text>
          </div>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell className="w-12">Sync</Table.HeaderCell>
                <Table.HeaderCell>Table Name</Table.HeaderCell>
                <Table.HeaderCell>Rows</Table.HeaderCell>
                <Table.HeaderCell>Size</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {tables.map((table) => (
                <Table.Row key={table.name}>
                  <Table.Cell>
                    <Checkbox
                      checked={table.selected}
                      onCheckedChange={() => toggleTable(table.name)}
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="font-mono text-sm">{table.name}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-sm">{table.row_count.toLocaleString()}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-sm text-gray-500">{table.size}</Text>
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
  label: "Database Sync",
  icon: CircleStack,
})

export default DatabaseSyncPage


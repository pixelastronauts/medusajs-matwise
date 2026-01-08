import React, { useState, useEffect } from "react"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Container,
  Button,
  Heading,
  Text,
  Badge,
  Input,
  Label,
  Textarea,
  Toaster,
  toast,
  Select,
} from "@medusajs/ui"
import { 
  ArrowPath, 
  CheckCircle, 
  XCircle, 
  ExclamationCircle,
  PaperPlane,
  Link as LinkIcon,
  ShoppingCart,
  Users,
} from "@medusajs/icons"

type WebhookConfig = {
  dashboard_url: string
  webhook_secret_configured: boolean
  webhook_secret_preview: string | null
}

type RecentOrder = {
  id: string
  display_id: number
  email: string
  status: string
  created_at: string
}

type RecentCustomer = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  created_at: string
}

type TestResult = {
  success: boolean
  message: string
  response?: any
  error?: string
  debug?: {
    url: string
    hasSignature: boolean
  }
  timestamp: string
}

const WebhookTestPage = () => {
  const [config, setConfig] = useState<WebhookConfig | null>(null)
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const [recentCustomers, setRecentCustomers] = useState<RecentCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [results, setResults] = useState<TestResult[]>([])
  
  // Form state
  const [orderId, setOrderId] = useState("")
  const [customerId, setCustomerId] = useState("")
  const [customEndpoint, setCustomEndpoint] = useState("/webhooks/medusa/ping")
  const [customData, setCustomData] = useState('{\n  "test": true\n}')
  const [customEventName, setCustomEventName] = useState("webhook.test")

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      setLoading(true)
      const response = await fetch("/admin/webhooks/test", {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })

      if (response.ok) {
        const data = await response.json()
        setConfig(data.config)
        setRecentOrders(data.recent_orders || [])
        setRecentCustomers(data.recent_customers || [])
      } else {
        toast.error("Failed to load webhook configuration")
      }
    } catch (error) {
      console.error("Error fetching config:", error)
      toast.error("Failed to load webhook configuration")
    } finally {
      setLoading(false)
    }
  }

  const addResult = (result: Omit<TestResult, "timestamp">) => {
    setResults(prev => [{
      ...result,
      timestamp: new Date().toISOString(),
    }, ...prev].slice(0, 20)) // Keep last 20 results
  }

  const testPing = async () => {
    setTesting(true)
    try {
      const response = await fetch("/admin/webhooks/test", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ping" }),
      })

      const data = await response.json()
      addResult({
        success: data.success,
        message: data.message,
        response: data.response,
        error: data.error,
        debug: data.debug,
      })

      if (data.success) {
        toast.success("Ping successful!")
      } else {
        toast.error(data.message || "Ping failed")
      }
    } catch (error: any) {
      addResult({
        success: false,
        message: "Request failed",
        error: error.message,
      })
      toast.error("Ping request failed")
    } finally {
      setTesting(false)
    }
  }

  const testOrder = async () => {
    if (!orderId.trim()) {
      toast.error("Please enter an Order ID")
      return
    }

    setTesting(true)
    try {
      const response = await fetch("/admin/webhooks/test", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "test_order",
          order_id: orderId.trim(),
        }),
      })

      const data = await response.json()
      addResult({
        success: data.success,
        message: data.message,
        response: data.response,
        error: data.error,
      })

      if (data.success) {
        toast.success(`Order webhook sent for ${orderId}`)
      } else {
        toast.error(data.message || "Order webhook failed")
      }
    } catch (error: any) {
      addResult({
        success: false,
        message: "Request failed",
        error: error.message,
      })
      toast.error("Order webhook request failed")
    } finally {
      setTesting(false)
    }
  }

  const testCustomer = async () => {
    if (!customerId.trim()) {
      toast.error("Please enter a Customer ID")
      return
    }

    setTesting(true)
    try {
      const response = await fetch("/admin/webhooks/test", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "test_customer",
          customer_id: customerId.trim(),
        }),
      })

      const data = await response.json()
      addResult({
        success: data.success,
        message: data.message,
        response: data.response,
        error: data.error,
      })

      if (data.success) {
        toast.success(`Customer webhook sent for ${customerId}`)
      } else {
        toast.error(data.message || "Customer webhook failed")
      }
    } catch (error: any) {
      addResult({
        success: false,
        message: "Request failed",
        error: error.message,
      })
      toast.error("Customer webhook request failed")
    } finally {
      setTesting(false)
    }
  }

  const testCustom = async () => {
    if (!customEndpoint.trim()) {
      toast.error("Please enter an endpoint")
      return
    }

    let parsedData
    try {
      parsedData = JSON.parse(customData)
    } catch (e) {
      toast.error("Invalid JSON data")
      return
    }

    setTesting(true)
    try {
      const response = await fetch("/admin/webhooks/test", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "test_custom",
          endpoint: customEndpoint.trim(),
          data: parsedData,
          event_name: customEventName.trim() || "webhook.test",
        }),
      })

      const data = await response.json()
      addResult({
        success: data.success,
        message: data.message,
        response: data.response,
        error: data.error,
      })

      if (data.success) {
        toast.success(`Custom webhook sent to ${customEndpoint}`)
      } else {
        toast.error(data.message || "Custom webhook failed")
      }
    } catch (error: any) {
      addResult({
        success: false,
        message: "Request failed",
        error: error.message,
      })
      toast.error("Custom webhook request failed")
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <Container className="p-8">
        <div className="flex items-center gap-2 mb-6">
          <ArrowPath className="animate-spin" />
          <Heading level="h1">Loading Webhook Configuration...</Heading>
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
            <PaperPlane className="w-8 h-8 text-blue-600" />
            <Heading level="h1">Webhook Tester</Heading>
          </div>
          <Text className="text-gray-500">
            Test webhook connectivity and send test payloads to the Dashboard
          </Text>
        </div>
        <Button variant="secondary" onClick={fetchConfig} disabled={testing}>
          <ArrowPath className={`mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Configuration Status */}
      <div className="bg-white border rounded-lg p-6 mb-8">
        <Heading level="h2" className="mb-4">Configuration Status</Heading>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
            <LinkIcon className="w-5 h-5 text-gray-500" />
            <div>
              <Text className="text-sm text-gray-500">Dashboard URL</Text>
              <Text className="font-mono text-sm">
                {config?.dashboard_url || "NOT SET"}
              </Text>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
            {config?.webhook_secret_configured ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600" />
            )}
            <div>
              <Text className="text-sm text-gray-500">Webhook Secret</Text>
              {config?.webhook_secret_configured ? (
                <Text className="font-mono text-sm text-green-700">
                  {config.webhook_secret_preview}
                </Text>
              ) : (
                <Text className="text-sm text-red-600">Not configured</Text>
              )}
            </div>
          </div>
        </div>

        {!config?.webhook_secret_configured && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-3">
              <ExclamationCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <Text className="text-sm text-yellow-800 font-medium">
                  Webhook secret not configured
                </Text>
                <Text className="text-sm text-yellow-700 mt-1">
                  Set <code className="bg-yellow-100 px-1 rounded">DASHBOARD_WEBHOOK_SECRET</code> in your environment to enable signed webhooks.
                </Text>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Tests */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Ping Test */}
        <div className="bg-white border rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <LinkIcon className="w-5 h-5 text-blue-600" />
            <Heading level="h3">Connection Test</Heading>
          </div>
          <Text className="text-sm text-gray-500 mb-4">
            Send a ping to test connectivity and signature verification.
          </Text>
          <Button 
            variant="primary" 
            onClick={testPing}
            disabled={testing}
            className="w-full"
          >
            {testing ? (
              <ArrowPath className="mr-2 animate-spin" />
            ) : (
              <PaperPlane className="mr-2" />
            )}
            Test Connection
          </Button>
        </div>

        {/* Order Test */}
        <div className="bg-white border rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="w-5 h-5 text-green-600" />
            <Heading level="h3">Order Webhook</Heading>
          </div>
          <div className="mb-4">
            <Label htmlFor="order-select" className="text-sm">Select Order</Label>
            <select
              id="order-select"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">-- Select an order --</option>
              {recentOrders.map((order) => (
                <option key={order.id} value={order.id}>
                  #{order.display_id} - {order.email} ({order.status})
                </option>
              ))}
            </select>
            <Text className="text-xs text-gray-400 mt-1">
              Or enter ID manually:
            </Text>
            <Input
              placeholder="order_01ABC..."
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              className="mt-1 font-mono text-sm"
            />
          </div>
          <Button 
            variant="secondary" 
            onClick={testOrder}
            disabled={testing || !orderId.trim()}
            className="w-full"
          >
            {testing ? (
              <ArrowPath className="mr-2 animate-spin" />
            ) : (
              <PaperPlane className="mr-2" />
            )}
            Send Order
          </Button>
        </div>

        {/* Customer Test */}
        <div className="bg-white border rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-purple-600" />
            <Heading level="h3">Customer Webhook</Heading>
          </div>
          <div className="mb-4">
            <Label htmlFor="customer-select" className="text-sm">Select Customer</Label>
            <select
              id="customer-select"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">-- Select a customer --</option>
              {recentCustomers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.first_name} {customer.last_name} - {customer.email}
                </option>
              ))}
            </select>
            <Text className="text-xs text-gray-400 mt-1">
              Or enter ID manually:
            </Text>
            <Input
              placeholder="cus_01ABC..."
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="mt-1 font-mono text-sm"
            />
          </div>
          <Button 
            variant="secondary" 
            onClick={testCustomer}
            disabled={testing || !customerId.trim()}
            className="w-full"
          >
            {testing ? (
              <ArrowPath className="mr-2 animate-spin" />
            ) : (
              <PaperPlane className="mr-2" />
            )}
            Send Customer
          </Button>
        </div>
      </div>

      {/* Custom Webhook */}
      <div className="bg-white border rounded-lg p-6 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <PaperPlane className="w-5 h-5 text-orange-600" />
          <Heading level="h2">Custom Webhook</Heading>
        </div>
        <Text className="text-sm text-gray-500 mb-4">
          Send a custom webhook payload to any endpoint.
        </Text>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <Label htmlFor="custom-endpoint" className="text-sm">Endpoint</Label>
            <Input
              id="custom-endpoint"
              placeholder="/webhooks/medusa/..."
              value={customEndpoint}
              onChange={(e) => setCustomEndpoint(e.target.value)}
              className="mt-1 font-mono"
            />
          </div>
          <div>
            <Label htmlFor="custom-event" className="text-sm">Event Name</Label>
            <Input
              id="custom-event"
              placeholder="webhook.test"
              value={customEventName}
              onChange={(e) => setCustomEventName(e.target.value)}
              className="mt-1 font-mono"
            />
          </div>
        </div>

        <div className="mb-4">
          <Label htmlFor="custom-data" className="text-sm">JSON Payload</Label>
          <Textarea
            id="custom-data"
            placeholder='{ "key": "value" }'
            value={customData}
            onChange={(e) => setCustomData(e.target.value)}
            className="mt-1 font-mono h-32"
          />
        </div>

        <Button 
          variant="secondary" 
          onClick={testCustom}
          disabled={testing || !customEndpoint.trim()}
        >
          {testing ? (
            <ArrowPath className="mr-2 animate-spin" />
          ) : (
            <PaperPlane className="mr-2" />
          )}
          Send Custom Webhook
        </Button>
      </div>

      {/* Results Log */}
      <div className="bg-white border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <Heading level="h2">Results Log</Heading>
          {results.length > 0 && (
            <Button 
              variant="secondary" 
              size="small"
              onClick={() => setResults([])}
            >
              Clear
            </Button>
          )}
        </div>

        {results.length === 0 ? (
          <div className="text-center py-8">
            <PaperPlane className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <Text className="text-gray-500">No test results yet</Text>
            <Text className="text-sm text-gray-400 mt-1">
              Send a webhook to see results here
            </Text>
          </div>
        ) : (
          <div className="space-y-3">
            {results.map((result, index) => (
              <div 
                key={index}
                className={`p-4 rounded-lg border ${
                  result.success 
                    ? "bg-green-50 border-green-200" 
                    : "bg-red-50 border-red-200"
                }`}
              >
                <div className="flex items-start gap-3">
                  {result.success ? (
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <Text className={`font-medium ${
                        result.success ? "text-green-900" : "text-red-900"
                      }`}>
                        {result.message}
                      </Text>
                      <Text className="text-xs text-gray-400">
                        {new Date(result.timestamp).toLocaleTimeString()}
                      </Text>
                    </div>
                    {result.debug && (
                      <Text className="text-xs text-gray-500 mt-1 font-mono">
                        → {result.debug.url} {result.debug.hasSignature ? '🔐' : '⚠️ no signature'}
                      </Text>
                    )}
                    {result.error && (
                      <Text className="text-sm text-red-700 mt-1 font-mono">
                        {result.error}
                      </Text>
                    )}
                    {result.response && (
                      <details className="mt-2">
                        <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-800">
                          View Response
                        </summary>
                        <pre className="mt-2 p-2 bg-white rounded text-xs overflow-auto max-h-40 font-mono">
                          {JSON.stringify(result.response, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Webhook Tester",
  icon: PaperPlane,
})

export default WebhookTestPage


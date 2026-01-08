import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { Modules } from '@medusajs/framework/utils'
import { sendDashboardWebhook } from '../../../../utils/webhook-signature'
import { DASHBOARD_API_URL, DASHBOARD_WEBHOOK_SECRET } from '../../../../lib/constants'

/**
 * GET /admin/webhooks/test
 * 
 * Get webhook configuration status and recent orders/customers for selection
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const dashboardUrl = process.env.DASHBOARD_URL || DASHBOARD_API_URL
  
  // Fetch recent orders and customers for the dropdowns
  const orderModule = req.scope.resolve(Modules.ORDER)
  const customerModule = req.scope.resolve(Modules.CUSTOMER)

  let recentOrders: any[] = []
  let recentCustomers: any[] = []

  try {
    const ordersResult = await orderModule.listOrders(
      {},
      { 
        order: { created_at: 'DESC' },
        take: 50,
        select: ['id', 'display_id', 'email', 'created_at', 'status'],
      }
    )
    recentOrders = ordersResult.map((o: any) => ({
      id: o.id,
      display_id: o.display_id,
      email: o.email,
      status: o.status,
      created_at: o.created_at,
    }))
  } catch (e) {
    console.error('Failed to fetch orders:', e)
  }

  try {
    const customersResult = await customerModule.listCustomers(
      {},
      {
        order: { created_at: 'DESC' },
        take: 50,
        select: ['id', 'email', 'first_name', 'last_name', 'created_at'],
      }
    )
    recentCustomers = customersResult.map((c: any) => ({
      id: c.id,
      email: c.email,
      first_name: c.first_name,
      last_name: c.last_name,
      created_at: c.created_at,
    }))
  } catch (e) {
    console.error('Failed to fetch customers:', e)
  }

  res.json({
    success: true,
    config: {
      dashboard_url: dashboardUrl || 'NOT SET',
      webhook_secret_configured: !!DASHBOARD_WEBHOOK_SECRET,
      webhook_secret_preview: DASHBOARD_WEBHOOK_SECRET 
        ? `${DASHBOARD_WEBHOOK_SECRET.slice(0, 4)}...${DASHBOARD_WEBHOOK_SECRET.slice(-4)}`
        : null,
    },
    recent_orders: recentOrders,
    recent_customers: recentCustomers,
    available_actions: {
      ping: 'POST with { "action": "ping" } - Test connection to dashboard',
      test_order: 'POST with { "action": "test_order", "order_id": "order_xxx" } - Re-send order webhook',
      test_customer: 'POST with { "action": "test_customer", "customer_id": "cus_xxx" } - Re-send customer webhook',
      test_custom: 'POST with { "action": "test_custom", "endpoint": "/webhooks/...", "data": {...}, "event_name": "..." } - Send custom webhook',
    }
  })
}

/**
 * POST /admin/webhooks/test
 * 
 * Test webhook endpoints
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { action, order_id, customer_id, endpoint, data, event_name } = req.body as any

  try {
    switch (action) {
      case 'ping': {
        // Simple ping to test connection
        const result = await sendDashboardWebhook({
          endpoint: '/webhooks/medusa/ping',
          data: {
            type: 'ping',
            timestamp: new Date().toISOString(),
            source: 'medusa-webhook-test',
          },
          eventName: 'webhook.ping',
        })

        return res.json({
          success: result.success,
          message: result.success 
            ? 'Dashboard connection successful!' 
            : `Dashboard connection failed: ${result.error}`,
          response: result.data,
          error: result.error,
          debug: result.debug,
        })
      }

      case 'test_order': {
        if (!order_id) {
          return res.status(400).json({
            success: false,
            message: 'order_id is required for test_order action',
          })
        }

        const orderModule = req.scope.resolve(Modules.ORDER)
        const customerModule = req.scope.resolve(Modules.CUSTOMER)

        const order = await orderModule.retrieveOrder(order_id, {
          relations: ['items', 'shipping_address', 'billing_address', 'summary'],
        })

        // Attach customer if present
        if (order.customer_id) {
          try {
            const customer = await customerModule.retrieveCustomer(order.customer_id)
            Object.assign(order, { customer })
          } catch (e) {
            // Customer not found, continue without
          }
        }

        const result = await sendDashboardWebhook({
          endpoint: '/webhooks/medusa/orders',
          data: order,
          eventName: 'order.placed',
        })

        return res.json({
          success: result.success,
          message: result.success
            ? `Order ${order_id} webhook sent successfully!`
            : `Failed to send order webhook: ${result.error}`,
          order_id: order.id,
          display_id: order.display_id,
          response: result.data,
          error: result.error,
        })
      }

      case 'test_customer': {
        if (!customer_id) {
          return res.status(400).json({
            success: false,
            message: 'customer_id is required for test_customer action',
          })
        }

        const customerModule = req.scope.resolve(Modules.CUSTOMER)
        const customer = await customerModule.retrieveCustomer(customer_id, {
          relations: ['addresses'],
        })

        const result = await sendDashboardWebhook({
          endpoint: '/webhooks/medusa/customers',
          data: customer,
          eventName: 'customer.updated',
        })

        return res.json({
          success: result.success,
          message: result.success
            ? `Customer ${customer_id} webhook sent successfully!`
            : `Failed to send customer webhook: ${result.error}`,
          customer_id: customer.id,
          email: customer.email,
          response: result.data,
          error: result.error,
        })
      }

      case 'test_custom': {
        if (!endpoint) {
          return res.status(400).json({
            success: false,
            message: 'endpoint is required for test_custom action',
          })
        }

        const result = await sendDashboardWebhook({
          endpoint,
          data: data || { test: true, timestamp: new Date().toISOString() },
          eventName: event_name || 'webhook.test',
        })

        return res.json({
          success: result.success,
          message: result.success
            ? `Custom webhook to ${endpoint} sent successfully!`
            : `Failed to send custom webhook: ${result.error}`,
          endpoint,
          response: result.data,
          error: result.error,
        })
      }

      default:
        return res.status(400).json({
          success: false,
          message: `Unknown action: ${action}. Available actions: ping, test_order, test_customer, test_custom`,
        })
    }
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Webhook test failed',
      error: error.message,
    })
  }
}


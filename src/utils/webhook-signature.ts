import { createHmac } from 'crypto'
import { DASHBOARD_API_URL, DASHBOARD_WEBHOOK_SECRET } from '../lib/constants'

/**
 * Generate HMAC-SHA256 signature for webhook payload
 */
export function generateWebhookSignature(payload: string): string | null {
  if (!DASHBOARD_WEBHOOK_SECRET) {
    return null
  }
  return createHmac('sha256', DASHBOARD_WEBHOOK_SECRET).update(payload).digest('hex')
}

/**
 * Options for sending a webhook to the dashboard
 */
interface SendWebhookOptions {
  /** The endpoint path (e.g., '/webhooks/medusa/orders') */
  endpoint: string
  /** The data to send */
  data: any
  /** The event name (e.g., 'order.placed') */
  eventName?: string
  /** Timeout in milliseconds (default: 10000) */
  timeout?: number
}

/**
 * Result of sending a webhook
 */
interface SendWebhookResult {
  success: boolean
  data?: any
  error?: string
}

/**
 * Send a signed webhook to the dashboard
 * 
 * @example
 * const result = await sendDashboardWebhook({
 *   endpoint: '/webhooks/medusa/orders',
 *   data: order,
 *   eventName: 'order.placed'
 * })
 */
export async function sendDashboardWebhook(options: SendWebhookOptions): Promise<SendWebhookResult> {
  const { endpoint, data, eventName, timeout = 10000 } = options
  
  // Get the dashboard URL from env or constants
  const baseUrl = process.env.DASHBOARD_URL || DASHBOARD_API_URL || ''
  
  if (!baseUrl) {
    return {
      success: false,
      error: 'DASHBOARD_URL is not configured'
    }
  }

  // Normalize the URL - ensure we have /api prefix
  let url = baseUrl
  if (!url.endsWith('/api') && !endpoint.startsWith('/api')) {
    url = url.replace(/\/$/, '') + '/api'
  }
  url = url.replace(/\/$/, '') + endpoint

  const body = JSON.stringify(data)
  
  // Build headers with signature
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (eventName) {
    headers['X-Medusa-Event'] = eventName
  }

  const signature = generateWebhookSignature(body)
  if (signature) {
    headers['X-Medusa-Signature'] = signature
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const text = await response.text()
      return {
        success: false,
        error: `Dashboard responded with ${response.status}: ${text}`
      }
    }

    const responseData = await response.json()
    return {
      success: true,
      data: responseData
    }
  } catch (error: any) {
    const errorMsg = error.name === 'AbortError' 
      ? 'Request timeout' 
      : error.message || 'Unknown error'
    
    return {
      success: false,
      error: errorMsg
    }
  }
}


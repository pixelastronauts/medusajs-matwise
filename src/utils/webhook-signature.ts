import { createHmac } from 'crypto'
import https from 'https'
import { DASHBOARD_API_URL, DASHBOARD_WEBHOOK_SECRET, IS_DEV } from '../lib/constants'

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
  debug?: {
    url: string
    hasSignature: boolean
  }
}

/**
 * Create an HTTPS agent that ignores SSL errors in development
 * This is needed for .test domains with self-signed certificates
 */
function createHttpsAgent() {
  if (IS_DEV) {
    return new https.Agent({
      rejectUnauthorized: false // Allow self-signed certs in dev
    })
  }
  return undefined
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

  // Log in development
  if (IS_DEV) {
    console.log(`🔗 Webhook request to: ${url}`)
    console.log(`   Event: ${eventName || 'none'}`)
    console.log(`   Signature: ${signature ? 'yes' : 'no'}`)
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    // Use custom fetch options for HTTPS with self-signed certs
    const fetchOptions: RequestInit & { agent?: https.Agent } = {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    }

    // For HTTPS URLs in development, we need to handle SSL differently
    // Node's fetch doesn't support agent directly, so we use a workaround
    if (IS_DEV && url.startsWith('https://')) {
      // Set NODE_TLS_REJECT_UNAUTHORIZED for this request
      const originalTLS = process.env.NODE_TLS_REJECT_UNAUTHORIZED
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
      
      try {
        const response = await fetch(url, fetchOptions)
        clearTimeout(timeoutId)

        if (!response.ok) {
          const text = await response.text()
          return {
            success: false,
            error: `Dashboard responded with ${response.status}: ${text}`,
            debug: { url, hasSignature: !!signature }
          }
        }

        const responseData = await response.json()
        return {
          success: true,
          data: responseData,
          debug: { url, hasSignature: !!signature }
        }
      } finally {
        // Restore original TLS setting
        if (originalTLS !== undefined) {
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTLS
        } else {
          delete process.env.NODE_TLS_REJECT_UNAUTHORIZED
        }
      }
    }

    const response = await fetch(url, fetchOptions)
    clearTimeout(timeoutId)

    if (!response.ok) {
      const text = await response.text()
      return {
        success: false,
        error: `Dashboard responded with ${response.status}: ${text}`,
        debug: { url, hasSignature: !!signature }
      }
    }

    const responseData = await response.json()
    return {
      success: true,
      data: responseData,
      debug: { url, hasSignature: !!signature }
    }
  } catch (error: any) {
    let errorMsg = error.message || 'Unknown error'
    
    if (error.name === 'AbortError') {
      errorMsg = `Request timeout after ${timeout}ms`
    } else if (error.cause) {
      // Include the cause for more details (e.g., SSL errors)
      errorMsg = `${errorMsg} (${error.cause.code || error.cause.message || 'unknown cause'})`
    }
    
    if (IS_DEV) {
      console.error(`❌ Webhook failed to ${url}:`, errorMsg)
      if (error.cause) {
        console.error('   Cause:', error.cause)
      }
    }
    
    return {
      success: false,
      error: errorMsg,
      debug: { url, hasSignature: !!signature }
    }
  }
}


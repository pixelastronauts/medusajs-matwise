import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { Modules } from '@medusajs/framework/utils'
import crypto from 'crypto'
import { STOREFRONT_URL } from '../../../../lib/constants'

interface ResendVerificationBody {
  email: string
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { email } = req.body as ResendVerificationBody

  if (!email) {
    return res.status(400).json({
      message: 'Email is required',
    })
  }

  const customerModuleService = req.scope.resolve(Modules.CUSTOMER)
  const notificationModuleService = req.scope.resolve(Modules.NOTIFICATION)
  const logger = req.scope.resolve('logger')

  try {
    // Find customer by email
    const customers = await customerModuleService.listCustomers({
      email: email,
    })

    // Always return success to prevent email enumeration
    if (!customers || customers.length === 0) {
      return res.status(200).json({
        success: true,
      })
    }

    const customer = customers[0]
    const metadata = customer.metadata as {
      email_verified?: boolean
    } | null

    // If already verified, still return success
    if (metadata?.email_verified === true) {
      return res.status(200).json({
        success: true,
      })
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex')
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours

    // Update customer with new token
    await customerModuleService.updateCustomers(customer.id, {
      metadata: {
        ...metadata,
        verification_token: verificationToken,
        verification_token_expiry: tokenExpiry,
      },
    })

    // Build verification URL
    const verifyUrl = `${STOREFRONT_URL}/account/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`

    // Send verification email
    await notificationModuleService.createNotifications({
      to: email,
      channel: 'email',
      template: 'email-verification',
      data: {
        first_name: customer.first_name || 'Klant',
        verify_url: verifyUrl,
        emailOptions: {
          subject: 'Bevestig je e-mailadres',
        },
      },
    })

    logger.info(`Verification email resent to ${email}`)

    return res.status(200).json({
      success: true,
    })
  } catch (error) {
    logger.error('Resend verification error:', error)
    // Still return success to prevent email enumeration
    return res.status(200).json({
      success: true,
    })
  }
}




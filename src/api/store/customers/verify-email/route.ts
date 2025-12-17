import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { Modules } from '@medusajs/framework/utils'

interface VerifyEmailBody {
  token: string
  email: string
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { token, email } = req.body as VerifyEmailBody

  if (!token || !email) {
    return res.status(400).json({
      message: 'Token and email are required',
    })
  }

  const customerModuleService = req.scope.resolve(Modules.CUSTOMER)
  const logger = req.scope.resolve('logger')

  try {
    // Find customer by email
    const customers = await customerModuleService.listCustomers({
      email: email,
    })

    if (!customers || customers.length === 0) {
      return res.status(400).json({
        message: 'Invalid verification link',
      })
    }

    const customer = customers[0]
    const metadata = customer.metadata as {
      email_verified?: boolean
      verification_token?: string
      verification_token_expiry?: string
    } | null

    // Check if already verified
    if (metadata?.email_verified === true) {
      return res.status(200).json({
        success: true,
        message: 'Email already verified',
        already_verified: true,
      })
    }

    // Verify token
    if (!metadata?.verification_token || metadata.verification_token !== token) {
      return res.status(400).json({
        message: 'Invalid verification token',
      })
    }

    // Check expiry
    if (metadata.verification_token_expiry) {
      const expiry = new Date(metadata.verification_token_expiry)
      if (expiry < new Date()) {
        return res.status(400).json({
          message: 'Verification link has expired',
          expired: true,
        })
      }
    }

    // Mark email as verified
    await customerModuleService.updateCustomers(customer.id, {
      metadata: {
        ...metadata,
        email_verified: true,
        verification_token: null,
        verification_token_expiry: null,
        verified_at: new Date().toISOString(),
      },
    })

    logger.info(`Email verified for customer ${customer.id} (${email})`)

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully',
    })
  } catch (error) {
    logger.error('Email verification error:', error)
    return res.status(500).json({
      message: 'An error occurred during verification',
    })
  }
}




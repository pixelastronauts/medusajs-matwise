import { Modules } from '@medusajs/framework/utils'
import type { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { STOREFRONT_URL } from '../lib/constants'
import crypto from 'crypto'

interface CustomerCreatedEventData {
  id: string
}

export default async function customerCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<CustomerCreatedEventData>) {
  const { id: customerId } = data
  
  const notificationModuleService = container.resolve(Modules.NOTIFICATION)
  const customerModuleService = container.resolve(Modules.CUSTOMER)
  const logger = container.resolve('logger')

  try {
    // Fetch customer details
    const customer = await customerModuleService.retrieveCustomer(customerId)
    
    if (!customer || !customer.email) {
      logger.warn(`Customer ${customerId} not found or has no email`)
      return
    }

    // Check if customer already has an account (has_account = true means registered, not guest)
    // Only send verification email for registered customers
    if (!customer.has_account) {
      logger.info(`Customer ${customerId} is a guest, skipping verification email`)
      return
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex')
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours

    // Store token in customer metadata
    await customerModuleService.updateCustomers(customerId, {
      metadata: {
        ...customer.metadata,
        email_verified: false,
        verification_token: verificationToken,
        verification_token_expiry: tokenExpiry,
      },
    })

    // Build verification URL
    const verifyUrl = `${STOREFRONT_URL}/account/verify-email?token=${verificationToken}&email=${encodeURIComponent(customer.email)}`

    // Send verification email
    await notificationModuleService.createNotifications({
      to: customer.email,
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

    logger.info(`Verification email sent to ${customer.email}`)
  } catch (error) {
    logger.error(`Failed to send verification email for customer ${customerId}:`, error)
    // Don't throw - we don't want to fail the customer creation
  }
}

export const config: SubscriberConfig = {
  event: 'customer.created',
}







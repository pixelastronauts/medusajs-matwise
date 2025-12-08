import { Modules } from '@medusajs/framework/utils'
import type { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { STOREFRONT_URL } from '../lib/constants'

interface PasswordResetEventData {
  entity_id: string // The user's email
  token: string // The reset token
  actor_type: string // 'customer' or 'user' (admin)
}

export default async function passwordResetHandler({
  event: { data },
  container,
}: SubscriberArgs<PasswordResetEventData>) {
  const { entity_id: email, token, actor_type } = data
  
  const notificationModuleService = container.resolve(Modules.NOTIFICATION)
  const logger = container.resolve('logger')

  // Only handle customer password resets (not admin)
  if (actor_type !== 'customer') {
    logger.info(`Password reset requested for non-customer actor type: ${actor_type}`)
    return
  }
  
  // Build reset password URL
  const resetUrl = `${STOREFRONT_URL}/account/reset-password?token=${token}&email=${encodeURIComponent(email)}`

  try {
    await notificationModuleService.createNotifications({
      to: email,
      channel: 'email',
      template: 'password-reset',
      data: {
        reset_url: resetUrl,
        emailOptions: {
          subject: 'Stel je wachtwoord opnieuw in',
        },
      },
    })

    logger.info(`Password reset email sent to ${email}`)
  } catch (error) {
    logger.error(`Failed to send password reset email to ${email}:`, error)
    throw error
  }
}

export const config: SubscriberConfig = {
  event: 'auth.password_reset',
}


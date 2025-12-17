import { Button, Link, Section, Text, Hr } from '@react-email/components'
import { Base } from './base'

/**
 * The key for the EmailVerificationEmail template
 */
export const EMAIL_VERIFICATION = 'email-verification'

/**
 * The props for the EmailVerificationEmail template
 */
export interface EmailVerificationEmailProps {
  /**
   * The customer's first name
   */
  first_name: string
  /**
   * The link to verify the email
   */
  verify_url: string
  /**
   * The preview text for the email
   */
  preview?: string
}

/**
 * Type guard for checking if the data is of type EmailVerificationEmailProps
 */
export const isEmailVerificationData = (data: any): data is EmailVerificationEmailProps =>
  typeof data.verify_url === 'string' && 
  typeof data.first_name === 'string' &&
  (typeof data.preview === 'string' || !data.preview)

/**
 * The EmailVerificationEmail template component
 */
export const EmailVerificationEmail = ({
  first_name,
  verify_url,
  preview = `Bevestig je e-mailadres`,
}: EmailVerificationEmailProps) => {
  return (
    <Base preview={preview}>
      <Section className="text-center">
        <Text className="text-black text-[24px] font-bold leading-[32px] mb-[24px]">
          Welkom!
        </Text>
        
        <Text className="text-black text-[14px] leading-[24px]">
          Hoi {first_name},
        </Text>
        
        <Text className="text-black text-[14px] leading-[24px]">
          Bedankt voor het aanmaken van je account. Klik op de knop hieronder om 
          je e-mailadres te bevestigen en je account te activeren.
        </Text>
        
        <Section className="mt-[24px] mb-[32px]">
          <Button
            className="bg-[#000000] rounded text-white text-[14px] font-semibold no-underline px-6 py-3"
            href={verify_url}
          >
            E-mailadres bevestigen
          </Button>
        </Section>
        
        <Text className="text-black text-[14px] leading-[24px]">
          Of kopieer en plak deze link in je browser:
        </Text>
        <Text style={{
          maxWidth: '100%',
          wordBreak: 'break-all',
          overflowWrap: 'break-word'
        }}>
          <Link
            href={verify_url}
            className="text-blue-600 no-underline text-[12px]"
          >
            {verify_url}
          </Link>
        </Text>
      </Section>
      
      <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />
      
      <Text className="text-[#666666] text-[12px] leading-[24px]">
        Deze link is 24 uur geldig. Als je geen account hebt aangemaakt, kun je 
        deze e-mail negeren.
      </Text>
    </Base>
  )
}

EmailVerificationEmail.PreviewProps = {
  first_name: 'Jan',
  verify_url: 'https://matwise.nl/account/verify-email?token=abc123&email=test@example.com'
} as EmailVerificationEmailProps

export default EmailVerificationEmail




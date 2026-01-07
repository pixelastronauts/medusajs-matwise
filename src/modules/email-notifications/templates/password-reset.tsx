import { Button, Link, Section, Text, Hr } from '@react-email/components'
import { Base } from './base'

/**
 * The key for the PasswordResetEmail template, used to identify it
 */
export const PASSWORD_RESET = 'password-reset'

/**
 * The props for the PasswordResetEmail template
 */
export interface PasswordResetEmailProps {
  /**
   * The link that the user can click to reset their password
   */
  reset_url: string
  /**
   * The preview text for the email, appears next to the subject
   * in mail providers like Gmail
   */
  preview?: string
}

/**
 * Type guard for checking if the data is of type PasswordResetEmailProps
 * @param data - The data to check
 */
export const isPasswordResetData = (data: any): data is PasswordResetEmailProps =>
  typeof data.reset_url === 'string' && (typeof data.preview === 'string' || !data.preview)

/**
 * The PasswordResetEmail template component built with react-email
 */
export const PasswordResetEmail = ({
  reset_url,
  preview = `Stel je wachtwoord opnieuw in`,
}: PasswordResetEmailProps) => {
  return (
    <Base preview={preview}>
      <Section className="text-center">
        <Text className="text-black text-[24px] font-bold leading-[32px] mb-[24px]">
          Wachtwoord herstellen
        </Text>
        
        <Text className="text-black text-[14px] leading-[24px]">
          Je hebt een verzoek ingediend om je wachtwoord opnieuw in te stellen. 
          Klik op de knop hieronder om een nieuw wachtwoord te kiezen.
        </Text>
        
        <Section className="mt-[24px] mb-[32px]">
          <Button
            className="bg-[#000000] rounded text-white text-[14px] font-semibold no-underline px-6 py-3"
            href={reset_url}
          >
            Wachtwoord herstellen
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
            href={reset_url}
            className="text-blue-600 no-underline text-[12px]"
          >
            {reset_url}
          </Link>
        </Text>
      </Section>
      
      <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />
      
      <Text className="text-[#666666] text-[12px] leading-[24px]">
        Als je geen wachtwoordherstel hebt aangevraagd, kun je deze e-mail negeren. 
        De link verloopt na 24 uur. Als je je zorgen maakt over de veiligheid van je account, 
        neem dan contact met ons op.
      </Text>
    </Base>
  )
}

PasswordResetEmail.PreviewProps = {
  reset_url: 'https://matwise.nl/account/reset-password?token=abc123&email=test@example.com'
} as PasswordResetEmailProps

export default PasswordResetEmail







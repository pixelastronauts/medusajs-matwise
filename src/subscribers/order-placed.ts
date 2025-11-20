import { Modules } from '@medusajs/framework/utils'
import { INotificationModuleService, IOrderModuleService } from '@medusajs/framework/types'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { EmailTemplates } from '../modules/email-notifications/templates'
import { generateInvoicePdfWorkflow } from '../workflows/generate-invoice-pdf'

export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<any>) {
  const notificationModuleService: INotificationModuleService = container.resolve(Modules.NOTIFICATION)
  const orderModuleService: IOrderModuleService = container.resolve(Modules.ORDER)
  
  const order = await orderModuleService.retrieveOrder(data.id, { relations: ['items', 'summary', 'shipping_address'] })
  const shippingAddress = await (orderModuleService as any).orderAddressService_.retrieve(order.shipping_address.id)

  // Generate invoice PDF
  let pdfBuffer: Buffer | undefined
  let binaryString: string | undefined

  try {
    const { result: { pdf_buffer } } = await generateInvoicePdfWorkflow(container)
      .run({
        input: {
          order_id: data.id,
        },
      })

    pdfBuffer = Buffer.from(pdf_buffer)
    // Convert to binary string to pass as attachment
    binaryString = [...pdfBuffer]
      .map((byte) => byte.toString(2).padStart(8, "0"))
      .join("")
  } catch (error) {
    console.error('Error generating invoice PDF:', error)
  }

  try {
    await notificationModuleService.createNotifications({
      to: order.email,
      channel: 'email',
      template: EmailTemplates.ORDER_PLACED,
      data: {
        emailOptions: {
          replyTo: 'info@example.com',
          subject: 'Your order has been placed'
        },
        order,
        shippingAddress,
        preview: 'Thank you for your order!'
      },
      ...(binaryString ? {
        attachments: [
          {
            content: binaryString,
            filename: `invoice-${order.id}.pdf`,
            content_type: "application/pdf",
            disposition: "attachment",
          },
        ],
      } : {}),
    })
  } catch (error) {
    console.error('Error sending order confirmation notification:', error)
  }
}

export const config: SubscriberConfig = {
  event: 'order.placed'
}

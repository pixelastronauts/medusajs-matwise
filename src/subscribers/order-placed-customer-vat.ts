import { Modules } from '@medusajs/framework/utils'
import { IOrderModuleService, ICustomerModuleService } from '@medusajs/framework/types'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'

export default async function orderPlacedCustomerVatHandler({
  event: { data },
  container,
}: SubscriberArgs<any>) {
  const orderModuleService: IOrderModuleService = container.resolve(Modules.ORDER)
  const customerModuleService: ICustomerModuleService = container.resolve(Modules.CUSTOMER)
  
  try {
    const order = await orderModuleService.retrieveOrder(data.id)
    
    // Check if order has VAT info and customer ID
    if (!order.customer_id || !order.metadata?.vat_number) {
      return
    }

    const vatNumber = order.metadata.vat_number as string
    const isCompanyCheckout = order.metadata.is_company_checkout === true

    // Update customer metadata with VAT number for future use
    await customerModuleService.updateCustomers(order.customer_id, {
      metadata: {
        vat_number: vatNumber,
        is_company: isCompanyCheckout,
        last_vat_update: new Date().toISOString(),
      }
    })

    console.log(`Saved VAT ${vatNumber} to customer ${order.customer_id}`)
  } catch (error) {
    console.error('Error saving VAT to customer:', error)
  }
}

export const config: SubscriberConfig = {
  event: 'order.placed'
}


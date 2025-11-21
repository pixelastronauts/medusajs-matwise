import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'

/**
 * Debug subscriber to log payment session creation
 * This helps us see what amount is being sent to Mollie
 */
export default async function paymentSessionDebugHandler({
  event: { data },
  container,
}: SubscriberArgs<any>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  try {
    console.log('\n🔍 ===== PAYMENT SESSION DEBUG =====')
    console.log('Event data:', JSON.stringify(data, null, 2))

    // If we have a cart_id, fetch the cart with totals
    if (data.cart_id) {
      const { data: carts } = await query.graph({
        entity: 'cart',
        fields: [
          'id',
          'total',
          'subtotal',
          'item_subtotal',
          'shipping_total',
          'tax_total',
          'discount_total',
          'metadata',
          'items.*',
          'items.adjustments.*',
        ],
        filters: {
          id: data.cart_id,
        },
      })

      const cart = carts[0]
      if (cart) {
        console.log('\n💰 Cart Financial Summary:')
        console.log(`   Cart ID: ${cart.id}`)
        console.log(`   Subtotal: €${((cart.item_subtotal || 0) / 100).toFixed(2)}`)
        console.log(`   Shipping: €${((cart.shipping_total || 0) / 100).toFixed(2)}`)
        console.log(`   Discount: €${((cart.discount_total || 0) / 100).toFixed(2)}`)
        console.log(`   Tax: €${((cart.tax_total || 0) / 100).toFixed(2)}`)
        console.log(`   TOTAL: €${((cart.total || 0) / 100).toFixed(2)} ← This goes to Mollie`)
        
        console.log('\n🏷️  Cart Metadata:')
        console.log(`   Reverse charge: ${cart.metadata?.reverse_charge_applies}`)
        console.log(`   Reverse charge amount: €${((cart.metadata?.reverse_charge_amount || 0) / 100).toFixed(2)}`)
        
        console.log('\n📦 Cart Items:')
        if (cart.items && cart.items.length > 0) {
          for (const item of cart.items) {
            console.log(`   - ${item.title || item.id}`)
            console.log(`     Unit price: €${((item.unit_price || 0) / 100).toFixed(2)}`)
            console.log(`     Quantity: ${item.quantity}`)
            console.log(`     Subtotal: €${((item.subtotal || 0) / 100).toFixed(2)}`)
            
            if (item.adjustments && item.adjustments.length > 0) {
              console.log(`     Adjustments:`)
              for (const adj of item.adjustments) {
                console.log(`       • ${adj.code}: €${((adj.amount || 0) / 100).toFixed(2)} (${adj.description || ''})`)
              }
            }
          }
        }
      }
    }

    console.log('\n===== END PAYMENT DEBUG =====\n')
  } catch (error) {
    console.error('Error in payment session debug subscriber:', error)
  }
}

export const config: SubscriberConfig = {
  event: ['payment.created', 'payment-collection.created']
}


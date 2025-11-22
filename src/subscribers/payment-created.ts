import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'

/**
 * Subscriber to adjust payment amount for reverse charge
 * When reverse charge applies, we need to reduce the payment amount by the VAT
 */
export default async function paymentCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<any>) {
  
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const paymentModule = container.resolve(Modules.PAYMENT)

  try {
    console.log('\n💳 ===== PAYMENT CREATED: REVERSE CHARGE CHECK =====')
    console.log('Data:', JSON.stringify(data, null, 2))
    
    // Get payment collection ID from the event
    const paymentCollectionId = data.id || data.payment_collection_id
    
    if (!paymentCollectionId) {
      console.log('❌ No payment collection ID found')
      return
    }
    
    // Get the payment collection with cart
    const paymentCollection = await paymentModule.retrievePaymentCollection(paymentCollectionId, {
      relations: ['payment_sessions']
    }) as any
    
    if (!paymentCollection || !paymentCollection.cart_id) {
      console.log('❌ Payment collection or cart not found')
      return
    }
    
    // Get the cart with metadata
    const { data: carts } = await query.graph({
      entity: 'cart',
      fields: [
        'id',
        'total',
        'metadata',
      ],
      filters: {
        id: paymentCollection.cart_id as string,
      },
    })

    const cart = carts[0]
    if (!cart) {
      console.log('❌ Cart not found')
      return
    }

    const reverseChargeApplies = cart.metadata?.reverse_charge_applies === true
    const reverseChargeAmount = (cart.metadata?.reverse_charge_amount as number) || 0

    if (reverseChargeApplies && reverseChargeAmount > 0) {
      console.log(`✅ Reverse charge applies`)
      console.log(`   Cart Total: €${((cart.total || 0) / 100).toFixed(2)}`)
      console.log(`   VAT to remove: €${(reverseChargeAmount / 100).toFixed(2)}`)
      
      const adjustedAmount = (cart.total || 0) - reverseChargeAmount
      console.log(`   Adjusted amount for payment: €${(adjustedAmount / 100).toFixed(2)}`)
      
      // Update payment collection amount
      await paymentModule.updatePaymentCollections(paymentCollectionId, {
        amount: adjustedAmount
      })
      
      console.log(`   ✅ Payment collection amount updated!`)
      
      // Also update payment sessions if they exist
      if (paymentCollection.payment_sessions && paymentCollection.payment_sessions.length > 0) {
        for (const session of paymentCollection.payment_sessions) {
          await paymentModule.updatePaymentSession({
            id: session.id,
            amount: adjustedAmount,
            currency_code: session.currency_code,
            data: {
              ...session.data,
              reverse_charge_applied: true,
              original_amount: cart.total,
              vat_removed: reverseChargeAmount
            }
          })
          console.log(`   ✅ Payment session ${session.id} updated!`)
        }
      }
    } else {
      console.log(`ℹ️  No reverse charge adjustment needed`)
    }

    console.log('===== END PAYMENT CREATED =====\n')
  } catch (error) {
    console.error('Error in payment-created subscriber:', error)
    console.error('Stack:', error.stack)
  }
}

export const config: SubscriberConfig = {
  event: ['payment-collection.created', 'payment-collection.payment-session.created']
}


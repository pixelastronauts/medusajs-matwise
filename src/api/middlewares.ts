import { defineMiddlewares } from '@medusajs/medusa'
import { Modules, ContainerRegistrationKeys } from '@medusajs/framework/utils'

console.log('✅ Middlewares file loaded!')

/**
 * Middleware to adjust payment amount for reverse charge
 * This intercepts payment collection creation and adjusts the amount
 */
export default defineMiddlewares({
  routes: [
    {
      matcher: '/store/payment-collections*',
      method: ['POST'],
      middlewares: [
        async (req, res, next) => {
          console.log('\n💳 ===== PAYMENT SESSION MIDDLEWARE =====')
          console.log('Request body:', JSON.stringify(req.body, null, 2))
          console.log('Request URL:', req.url)
          console.log('Request params:', JSON.stringify(req.params, null, 2))
          
          try {
            // Extract payment collection ID from URL since params might not work with wildcard matcher
            const urlMatch = req.url?.match(/\/payment-collections\/([^\/]+)\/payment-sessions/)
            const paymentCollectionId = urlMatch?.[1] || req.params.id
            
            console.log('Extracted Payment Collection ID:', paymentCollectionId)
            
            if (!paymentCollectionId) {
              console.log('No payment collection ID in params')
              return next()
            }
            
            // Get payment collection
            const paymentModule = req.scope.resolve(Modules.PAYMENT)
            const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
            const paymentCollection = await paymentModule.retrievePaymentCollection(paymentCollectionId)
            
            console.log('Payment collection amount:', paymentCollection.amount)
            
            // We need to find the cart that has this payment collection
            // Since we can't filter by payment_collection.id directly, we'll use query.graph
            // to get all recent carts and check their payment_collection
            const { data: allCarts } = await query.graph({
              entity: 'cart',
              fields: ['id', 'total', 'metadata', 'payment_collection.id'],
            })
            
            console.log('Searching through carts for payment collection...')
            
            // Find the cart with matching payment collection
            const cart = allCarts.find((c: any) => c.payment_collection?.id === paymentCollectionId)
            
            if (!cart) {
              console.log('No cart found for payment collection:', paymentCollectionId)
              return next()
            }
            
            console.log('Cart found:', { id: cart.id, total: cart.total, metadata: cart.metadata })
            
            const reverseChargeApplies = cart.metadata?.reverse_charge_applies === true
            const reverseChargeAmount = (cart.metadata?.reverse_charge_amount as number) || 0
            
            if (reverseChargeApplies && reverseChargeAmount > 0) {
              // ALWAYS calculate from cart.total (not payment collection amount)
              // to avoid reducing the amount multiple times when user changes payment method
              const originalAmount = cart.total
              const adjustedAmount = originalAmount - reverseChargeAmount
              
              console.log(`✅ Reverse charge detected!`)
              console.log(`   Cart total: €${(originalAmount / 100).toFixed(2)}`)
              console.log(`   VAT to remove: €${(reverseChargeAmount / 100).toFixed(2)}`)
              console.log(`   Adjusted amount: €${(adjustedAmount / 100).toFixed(2)}`)
              console.log(`   Current payment collection amount: €${(paymentCollection.amount / 100).toFixed(2)}`)
              
              // Only update if the amount is different (avoid unnecessary updates)
              if (paymentCollection.amount !== adjustedAmount) {
                await paymentModule.updatePaymentCollections(paymentCollectionId, {
                  amount: adjustedAmount
                })
                console.log(`   ✅ Payment collection amount updated!`)
              } else {
                console.log(`   ℹ️  Payment collection amount already correct`)
              }
            } else {
              console.log(`ℹ️  No reverse charge adjustment needed`)
            }
            
            console.log('===== END PAYMENT SESSION MIDDLEWARE =====\n')
          } catch (error) {
            console.error('Error in payment session middleware:', error)
            console.error('Stack:', error.stack)
          }
          
          next()
        }
      ]
    }
  ]
})

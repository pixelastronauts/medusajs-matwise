import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { Modules, ContainerRegistrationKeys } from '@medusajs/framework/utils'

/**
 * Debug endpoint to check payment details before placing order
 * GET /store/debug-payment?cart_id=xxx
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const cartId = req.query.cart_id as string
  
  if (!cartId) {
    return res.status(400).json({
      error: 'cart_id query parameter is required'
    })
  }
  
  try {
    console.log(`🔍 Debug payment endpoint called for cart: ${cartId}`)
    
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const paymentModule = req.scope.resolve(Modules.PAYMENT)
    
    // Get cart with all details
    console.log('Fetching cart via query.graph...')
    let cart
    try {
      const { data: carts } = await query.graph({
        entity: 'cart',
        fields: [
          'id',
          'total',
          'subtotal',
          'item_subtotal',
          'shipping_total',
          'discount_total',
          'tax_total',
          'metadata',
          'items.*',
          'items.adjustments.*',
        ],
        filters: { id: cartId },
      })
      cart = carts[0]
      console.log('Cart fetched successfully')
    } catch (queryError) {
      console.error('Error fetching cart with query.graph:', queryError)
      return res.status(500).json({
        error: 'Failed to fetch cart',
        details: queryError.message
      })
    }
    
    if (!cart) {
      console.log('Cart not found')
      return res.status(404).json({
        error: 'Cart not found'
      })
    }
    
    // Get payment collection if it exists
    console.log('Checking for payment collection...')
    let paymentCollectionDetails = null
    
    // Try to find payment collection via query.graph using the cart's payment_collection link
    try {
      const { data: cartsWithPayment } = await query.graph({
        entity: 'cart',
        fields: [
          'id',
          'payment_collection.*',
          'payment_collection.payment_sessions.*',
        ],
        filters: { id: cartId },
      })
      
      if (cartsWithPayment?.[0]?.payment_collection) {
        paymentCollectionDetails = cartsWithPayment[0].payment_collection
        console.log('Payment collection found:', paymentCollectionDetails.id)
      } else {
        console.log('No payment collection found for this cart')
      }
    } catch (error) {
      console.error('Error fetching payment collection:', error)
      // Continue without payment collection
    }
    
    // Calculate what SHOULD be charged with reverse charge
    const reverseChargeApplies = cart.metadata?.reverse_charge_applies === true
    const reverseChargeAmount = (cart.metadata?.reverse_charge_amount as number) || 0
    const expectedPaymentAmount = reverseChargeApplies 
      ? cart.total - reverseChargeAmount 
      : cart.total
    
    // Build debug response
    const debugInfo = {
      timestamp: new Date().toISOString(),
      cart: {
        id: cart.id,
        totals: {
          subtotal: cart.subtotal,
          item_subtotal: cart.item_subtotal,
          shipping_total: cart.shipping_total,
          discount_total: cart.discount_total,
          tax_total: cart.tax_total,
          total: cart.total,
          formatted: {
            subtotal: `€${Number(cart.subtotal || 0).toFixed(2)}`,
            item_subtotal: `€${Number(cart.item_subtotal || 0).toFixed(2)}`,
            shipping_total: `€${Number(cart.shipping_total || 0).toFixed(2)}`,
            discount_total: `€${Number(cart.discount_total || 0).toFixed(2)}`,
            tax_total: `€${Number(cart.tax_total || 0).toFixed(2)}`,
            total: `€${Number(cart.total || 0).toFixed(2)}`,
          }
        },
        metadata: cart.metadata,
        items: cart.items?.map((item: any) => ({
          id: item.id,
          title: item.title,
          unit_price: item.unit_price,
          quantity: item.quantity,
          subtotal: item.subtotal,
          total: item.total,
          formatted: {
            unit_price: `€${Number(item.unit_price || 0).toFixed(2)}`,
            subtotal: `€${Number(item.subtotal || 0).toFixed(2)}`,
            total: `€${Number(item.total || 0).toFixed(2)}`,
          },
          adjustments: item.adjustments?.map((adj: any) => ({
            code: adj.code,
            description: adj.description,
            amount: adj.amount,
            formatted: `€${Number(adj.amount || 0).toFixed(2)}`,
          }))
        }))
      },
      reverse_charge: {
        applies: reverseChargeApplies,
        vat_amount: reverseChargeAmount,
        vat_percentage: cart.metadata?.reverse_charge_percentage || 0,
        formatted: {
          vat_amount: `€${Number(reverseChargeAmount).toFixed(2)}`,
        }
      },
      payment: {
        expected_amount: expectedPaymentAmount,
        formatted_expected: `€${Number(expectedPaymentAmount).toFixed(2)}`,
        collection: paymentCollectionDetails ? {
          id: paymentCollectionDetails.id,
          amount: paymentCollectionDetails.amount,
          currency_code: paymentCollectionDetails.currency_code,
          status: paymentCollectionDetails.status,
          formatted_amount: `€${Number(paymentCollectionDetails.amount || 0).toFixed(2)}`,
          sessions: paymentCollectionDetails.payment_sessions?.map((session: any) => ({
            id: session.id,
            provider_id: session.provider_id,
            amount: session.amount,
            status: session.status,
            formatted_amount: `€${Number(session.amount || 0).toFixed(2)}`,
          }))
        } : null
      },
      checks: {
        amounts_match: paymentCollectionDetails 
          ? Number(paymentCollectionDetails.amount) === Number(expectedPaymentAmount)
          : null,
        reverse_charge_applied: reverseChargeApplies 
          ? (Number(paymentCollectionDetails?.amount) === Number(expectedPaymentAmount))
          : true,
        mollie_will_charge: paymentCollectionDetails?.payment_sessions?.[0]?.amount 
          ? `€${Number(paymentCollectionDetails.payment_sessions[0].amount || 0).toFixed(2)}`
          : 'No payment session yet'
      }
    }
    
    console.log('✅ Debug info generated successfully')
    res.json(debugInfo)
  } catch (error) {
    console.error('❌ Error in debug-payment endpoint:', error)
    console.error('Stack:', error.stack)
    res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}


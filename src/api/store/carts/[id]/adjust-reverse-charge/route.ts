import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * POST /store/carts/:id/adjust-reverse-charge
 * 
 * This endpoint adjusts the payment collection amount for reverse charge.
 * Call this AFTER selecting a payment provider but BEFORE redirecting to payment.
 * 
 * For reverse charge (EU B2B), the VAT should not be charged, so we reduce
 * the payment collection amount by the reverse_charge_amount stored in cart metadata.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { id: cartId } = req.params
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const paymentModule = req.scope.resolve(Modules.PAYMENT)

  try {
    console.log('\n🔧 ===== ADJUST REVERSE CHARGE =====')
    console.log(`Cart ID: ${cartId}`)

    // Get cart with payment collection
    const { data: carts } = await query.graph({
      entity: 'cart',
      fields: [
        'id',
        'total',
        'metadata',
        'payment_collection.id',
        'payment_collection.amount',
        'payment_collection.payment_sessions.*',
      ],
      filters: { id: cartId },
    })

    const cart = carts[0]
    if (!cart) {
      console.log('❌ Cart not found')
      return res.status(404).json({ error: 'Cart not found' })
    }

    console.log('Cart found:', { 
      id: cart.id, 
      total: cart.total, 
      metadata: cart.metadata,
      payment_collection_id: cart.payment_collection?.id,
      payment_collection_amount: cart.payment_collection?.amount
    })

    // Check if reverse charge applies
    const reverseChargeApplies = cart.metadata?.reverse_charge_applies === true
    const reverseChargeAmount = Number(cart.metadata?.reverse_charge_amount || 0)

    if (!reverseChargeApplies || reverseChargeAmount <= 0) {
      console.log('ℹ️  No reverse charge adjustment needed')
      return res.json({
        adjusted: false,
        reason: 'Reverse charge does not apply',
        cart_total: cart.total,
        payment_collection_amount: cart.payment_collection?.amount
      })
    }

    if (!cart.payment_collection?.id) {
      console.log('❌ No payment collection found')
      return res.status(400).json({ 
        error: 'No payment collection found. Please select a payment method first.' 
      })
    }

    // Calculate adjusted amount (Medusa v2 uses major units - euros)
    const originalAmount = Number(cart.total || 0)
    const adjustedAmount = originalAmount - reverseChargeAmount

    console.log(`✅ Reverse charge adjustment:`)
    console.log(`   Original amount: €${originalAmount.toFixed(2)}`)
    console.log(`   Reverse charge (VAT to remove): €${reverseChargeAmount.toFixed(2)}`)
    console.log(`   Adjusted amount: €${adjustedAmount.toFixed(2)}`)
    console.log(`   Current payment collection amount: €${Number(cart.payment_collection.amount || 0).toFixed(2)}`)

    // Only update if needed
    if (Number(cart.payment_collection.amount) !== adjustedAmount) {
      // Update payment collection amount
      await paymentModule.updatePaymentCollections(cart.payment_collection.id, {
        amount: adjustedAmount
      })
      console.log('   ✅ Payment collection amount updated!')

      // Also update any existing payment sessions
      if (cart.payment_collection.payment_sessions?.length > 0) {
        for (const session of cart.payment_collection.payment_sessions) {
          try {
            await paymentModule.updatePaymentSession({
              id: session.id,
              amount: adjustedAmount,
              currency_code: session.currency_code,
              data: {
                ...session.data,
                reverse_charge_applied: true,
                original_amount: originalAmount,
                vat_removed: reverseChargeAmount
              }
            })
            console.log(`   ✅ Payment session ${session.id} updated!`)
          } catch (sessionError) {
            console.error(`   ⚠️  Could not update payment session ${session.id}:`, sessionError.message)
            // Continue - session update failure shouldn't block the adjustment
          }
        }
      }

      console.log('===== END ADJUST REVERSE CHARGE =====\n')

      return res.json({
        adjusted: true,
        original_amount: originalAmount,
        reverse_charge_amount: reverseChargeAmount,
        adjusted_amount: adjustedAmount,
        formatted: {
          original: `€${originalAmount.toFixed(2)}`,
          vat_removed: `€${reverseChargeAmount.toFixed(2)}`,
          final: `€${adjustedAmount.toFixed(2)}`
        }
      })
    } else {
      console.log('   ℹ️  Payment collection amount already correct')
      console.log('===== END ADJUST REVERSE CHARGE =====\n')

      return res.json({
        adjusted: false,
        reason: 'Payment collection amount already correct',
        current_amount: adjustedAmount,
        formatted: `€${adjustedAmount.toFixed(2)}`
      })
    }
  } catch (error: any) {
    console.error('❌ Error adjusting reverse charge:', error)
    console.error('Stack:', error.stack)
    return res.status(500).json({
      error: 'Failed to adjust reverse charge',
      message: error.message
    })
  }
}





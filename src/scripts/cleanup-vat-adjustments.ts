import { MedusaContainer } from '@medusajs/framework/types'
import { Modules } from '@medusajs/framework/utils'

/**
 * Script to remove all VAT_REVERSE_CHARGE adjustments from carts
 * Run with: npx medusa exec ./src/scripts/cleanup-vat-adjustments.ts
 */
export default async function cleanupVatAdjustments(container: MedusaContainer) {
  const cartModuleService = container.resolve(Modules.CART)
  
  console.log('🧹 Starting VAT adjustment cleanup...\n')
  
  try {
    // Get all carts
    const { carts } = await cartModuleService.listCarts({}, {
      relations: ['items', 'items.adjustments']
    })
    
    console.log(`Found ${carts.length} carts to check`)
    
    let totalRemoved = 0
    
    for (const cart of carts) {
      if (!cart.items || cart.items.length === 0) continue
      
      // Find all VAT_REVERSE_CHARGE adjustments
      const vatAdjustments = cart.items
        .flatMap(item => item.adjustments || [])
        .filter(adj => adj.code === 'VAT_REVERSE_CHARGE')
      
      if (vatAdjustments.length > 0) {
        console.log(`  Cart ${cart.id}: Removing ${vatAdjustments.length} VAT adjustments`)
        
        await cartModuleService.softDeleteLineItemAdjustments(
          vatAdjustments.map(adj => adj.id)
        )
        
        totalRemoved += vatAdjustments.length
      }
    }
    
    console.log(`\n✅ Cleanup complete! Removed ${totalRemoved} VAT adjustments from ${carts.length} carts`)
  } catch (error) {
    console.error('❌ Error during cleanup:', error)
    throw error
  }
}


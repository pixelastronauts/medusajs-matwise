import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { Modules } from '@medusajs/framework/utils'

/**
 * Admin API route to cleanup VAT_REVERSE_CHARGE adjustments
 * GET http://localhost:9000/admin/cleanup-vat
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const cartModuleService = req.scope.resolve(Modules.CART)
  
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
    
    res.json({
      success: true,
      message: `Removed ${totalRemoved} VAT adjustments from ${carts.length} carts`,
      totalRemoved,
      cartsChecked: carts.length
    })
  } catch (error) {
    console.error('❌ Error during cleanup:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}


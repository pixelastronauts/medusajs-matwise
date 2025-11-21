import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { ICartModuleService } from "@medusajs/framework/types"

// GET /store/carts/:id/taxes - Get tax information for a cart
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const cartModuleService: ICartModuleService = req.scope.resolve(Modules.CART)
  const { id } = req.params

  try {
    const cart = await cartModuleService.retrieveCart(id, {
      relations: ['shipping_address', 'items']
    })

    if (!cart) {
      return res.status(404).json({
        message: "Cart not found"
      })
    }

    const metadata = cart.metadata || {}
    const shouldCalculateTax = metadata.should_calculate_tax !== false // Default true
    const vatNumber = metadata.vat_number as string | null
    const isCompanyCheckout = metadata.is_company_checkout === true

    return res.json({
      cart_id: cart.id,
      should_calculate_tax: shouldCalculateTax,
      is_company_checkout: isCompanyCheckout,
      vat_number: vatNumber,
      shipping_country: cart.shipping_address?.country_code
    })
  } catch (error: any) {
    console.error("Error fetching cart tax info:", error)
    return res.status(500).json({
      message: "Failed to fetch cart tax information",
      error: error.message
    })
  }
}


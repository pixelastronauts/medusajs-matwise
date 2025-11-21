import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { VAT_VALIDATION_MODULE } from "../../../modules/vat_validation"
import type VatValidationService from "../../../modules/vat_validation/service"

export const PostValidateVatSchema = z.object({
  vat_number: z.string().min(1, "VAT number is required"),
})

export type PostValidateVatSchemaType = z.infer<typeof PostValidateVatSchema>

// POST /store/validate-vat - Validate a VAT number
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    console.log("VAT validation request body:", req.body)
    console.log("VAT validation request body type:", typeof req.body)
    
    // Parse and validate the request body
    const parsed = PostValidateVatSchema.safeParse(req.body)
    
    if (!parsed.success) {
      console.log("VAT validation schema errors:", parsed.error.errors)
      return res.status(400).json({
        valid: false,
        error: "VAT number is required",
        details: parsed.error.errors
      })
    }
    
    const { vat_number } = parsed.data
    console.log("Extracted vat_number:", vat_number)
    
    const vatValidationService = req.scope.resolve(VAT_VALIDATION_MODULE) as VatValidationService
    const result = await vatValidationService.validateVatNumber(vat_number)
    
    return res.json({
      valid: result.valid,
      country: result.country_code,
      vatNumber: result.vat_number,
      company: result.company_name,
      address: result.company_address,
      error: result.error
    })
  } catch (error: any) {
    console.error("VAT validation error:", error)
    console.error("Error stack:", error.stack)
    return res.status(500).json({
      valid: false,
      error: `Failed to validate VAT number: ${error.message}`
    })
  }
}


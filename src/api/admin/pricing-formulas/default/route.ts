import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { PRICING_FORMULA_MODULE, type PricingFormulaService } from "../../../../modules/pricing-formula";

/**
 * GET /admin/pricing-formulas/default
 * Get the default pricing formula
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const pricingFormulaService = req.scope.resolve(PRICING_FORMULA_MODULE) as PricingFormulaService;

  try {
    const defaultFormula = await pricingFormulaService.getDefaultFormula();
    
    res.json({
      formula: defaultFormula,
    });
  } catch (error: any) {
    res.status(500).json({
      message: "Failed to get default formula",
      error: error.message,
    });
  }
};








import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { PRICING_FORMULA_MODULE, type PricingFormulaService } from "../../../../../modules/pricing-formula";

// POST /admin/pricing-formulas/:id/calculate - Calculate price using a specific formula
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const pricingFormulaService = req.scope.resolve(PRICING_FORMULA_MODULE) as PricingFormulaService;
  const { id } = req.params;
  const { variables, volumeMultiplier = 1.0 } = req.body as {
    variables: Record<string, number>;
    volumeMultiplier?: number;
  };

  if (!variables) {
    return res.status(400).json({
      message: "Variables are required",
    });
  }

  try {
    const price = await pricingFormulaService.calculatePrice(
      id,
      variables,
      volumeMultiplier
    );

    res.json({
      price,
      variables,
      volumeMultiplier,
    });
  } catch (error: any) {
    res.status(500).json({
      message: "Failed to calculate price",
      error: error.message,
    });
  }
};



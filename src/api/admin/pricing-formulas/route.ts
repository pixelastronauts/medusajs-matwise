import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { PRICING_FORMULA_MODULE, type PricingFormulaService } from "../../../modules/pricing-formula";

// GET /admin/pricing-formulas - List all pricing formulas
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const pricingFormulaService = req.scope.resolve(PRICING_FORMULA_MODULE) as PricingFormulaService;

  try {
    const formulas = await pricingFormulaService.listFormulas();

    res.json({
      formulas,
    });
  } catch (error: any) {
    res.status(500).json({
      message: "Failed to list pricing formulas",
      error: error.message,
    });
  }
};

// POST /admin/pricing-formulas - Create a new pricing formula
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const pricingFormulaService = req.scope.resolve(PRICING_FORMULA_MODULE) as PricingFormulaService;

  const { name, description, formula_string, parameters } = req.body as {
    name: string;
    description?: string;
    formula_string: string;
    parameters: Record<string, number>;
  };

  if (!name || !formula_string || !parameters) {
    return res.status(400).json({
      message: "Name, formula_string, and parameters are required",
    });
  }

  try {
    // Validate formula before creating
    const validation = await pricingFormulaService.validateFormula(
      formula_string,
      parameters
    );

    if (!validation.valid) {
      return res.status(400).json({
        message: "Invalid formula",
        error: validation.error,
      });
    }

    const formula = await pricingFormulaService.createFormula({
      name,
      description,
      formula_string,
      parameters,
    });

    res.json({
      formula,
    });
  } catch (error: any) {
    res.status(500).json({
      message: "Failed to create pricing formula",
      error: error.message,
    });
  }
};


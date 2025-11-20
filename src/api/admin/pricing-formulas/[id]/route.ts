import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { PRICING_FORMULA_MODULE, type PricingFormulaService } from "../../../../modules/pricing-formula";

// GET /admin/pricing-formulas/:id - Get a specific pricing formula
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const pricingFormulaService = req.scope.resolve(PRICING_FORMULA_MODULE) as PricingFormulaService;
  const { id } = req.params;

  try {
    const formula = await pricingFormulaService.retrieveFormula(id);

    if (!formula) {
      return res.status(404).json({
        message: "Pricing formula not found",
      });
    }

    res.json({
      formula,
    });
  } catch (error: any) {
    res.status(500).json({
      message: "Failed to retrieve pricing formula",
      error: error.message,
    });
  }
};

// POST /admin/pricing-formulas/:id - Update a pricing formula
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const pricingFormulaService = req.scope.resolve(PRICING_FORMULA_MODULE) as PricingFormulaService;
  const { id } = req.params;
  const { name, description, formula_string, parameters, is_active } = req.body as {
    name?: string;
    description?: string;
    formula_string?: string;
    parameters?: Record<string, number>;
    is_active?: boolean;
  };

  try {
    // If formula_string or parameters are being updated, validate
    if (formula_string || parameters) {
      const formula = await pricingFormulaService.retrieveFormula(id);
      
      const validation = await pricingFormulaService.validateFormula(
        formula_string || formula.formula_string,
        parameters || (formula.parameters as Record<string, number>)
      );

      if (!validation.valid) {
        return res.status(400).json({
          message: "Invalid formula",
          error: validation.error,
        });
      }
    }

    const formula = await pricingFormulaService.updateFormula(id, {
      name,
      description,
      formula_string,
      parameters,
      is_active,
    });

    res.json({
      formula,
    });
  } catch (error: any) {
    res.status(500).json({
      message: "Failed to update pricing formula",
      error: error.message,
    });
  }
};

// DELETE /admin/pricing-formulas/:id - Delete a pricing formula
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const pricingFormulaService = req.scope.resolve(PRICING_FORMULA_MODULE) as PricingFormulaService;
  const { id } = req.params;

  try {
    await pricingFormulaService.deleteFormula(id);

    res.json({
      id,
      deleted: true,
    });
  } catch (error: any) {
    res.status(500).json({
      message: "Failed to delete pricing formula",
      error: error.message,
    });
  }
};


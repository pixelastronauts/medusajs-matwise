import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { PRICING_FORMULA_MODULE, type PricingFormulaService } from "../../../../../modules/pricing-formula";

// GET /store/products/:id/pricing-formula - Get pricing formula for a product
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const productModuleService = req.scope.resolve(Modules.PRODUCT);
  const pricingFormulaService = req.scope.resolve(PRICING_FORMULA_MODULE) as PricingFormulaService;
  
  const { id: productId } = req.params;

  try {
    // Get product to check for formula ID in metadata
    const product = await productModuleService.retrieveProduct(productId, {
      select: ["id", "metadata"],
    });

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    // Check if product has a pricing formula attached
    const formulaId = product.metadata?.pricing_formula_id as string | undefined;

    if (!formulaId) {
      return res.json({
        has_formula: false,
        formula: null,
      });
    }

    // Retrieve the formula
    const formula = await pricingFormulaService.retrieveFormula(formulaId);

    if (!formula || !formula.is_active) {
      return res.json({
        has_formula: false,
        formula: null,
      });
    }

    res.json({
      has_formula: true,
      formula: {
        id: formula.id,
        name: formula.name,
        description: formula.description,
        formula_string: formula.formula_string,
        parameters: formula.parameters,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      message: "Failed to retrieve pricing formula",
      error: error.message,
    });
  }
};



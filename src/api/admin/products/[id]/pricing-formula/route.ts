import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { PRICING_FORMULA_MODULE, type PricingFormulaService } from "../../../../../modules/pricing-formula";
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows";

// POST /admin/products/:id/pricing-formula - Attach or update pricing formula for a product
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const productModuleService = req.scope.resolve(Modules.PRODUCT);
  const pricingFormulaService = req.scope.resolve(PRICING_FORMULA_MODULE) as PricingFormulaService;
  
  const { id: productId } = req.params;
  const { formula_id } = req.body as { formula_id: string | null };

  try {
    // Verify formula exists and is active
    if (formula_id) {
      const formula = await pricingFormulaService.retrieveFormula(formula_id);
      
      if (!formula) {
        return res.status(404).json({
          message: "Pricing formula not found",
        });
      }

      if (!formula.is_active) {
        return res.status(400).json({
          message: "Cannot attach inactive pricing formula",
        });
      }
    }

    // Get product
    const product = await productModuleService.retrieveProduct(productId, {
      select: ["id", "metadata"],
    });

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    // Update product metadata with formula ID using workflow
    await updateProductsWorkflow(req.scope).run({
      input: {
        products: [{
          id: productId,
          metadata: {
            ...product.metadata,
            pricing_formula_id: formula_id || null,
          },
        }],
      },
    });

    res.json({
      product_id: productId,
      formula_id: formula_id || null,
      message: formula_id 
        ? "Pricing formula attached to product" 
        : "Pricing formula removed from product",
    });
  } catch (error: any) {
    res.status(500).json({
      message: "Failed to update product pricing formula",
      error: error.message,
    });
  }
};

// DELETE /admin/products/:id/pricing-formula - Remove pricing formula from a product
export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const productModuleService = req.scope.resolve(Modules.PRODUCT);
  const { id: productId } = req.params;

  try {
    const product = await productModuleService.retrieveProduct(productId, {
      select: ["id", "metadata"],
    });

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    // Remove formula ID from metadata
    const { pricing_formula_id, ...restMetadata } = product.metadata || {};

    await updateProductsWorkflow(req.scope).run({
      input: {
        products: [{
          id: productId,
          metadata: restMetadata,
        }],
      },
    });

    res.json({
      product_id: productId,
      message: "Pricing formula removed from product",
    });
  } catch (error: any) {
    res.status(500).json({
      message: "Failed to remove pricing formula from product",
      error: error.message,
    });
  }
};



import { MedusaService } from "@medusajs/framework/utils";
import PricingFormula from "./models/pricing-formula";

class PricingFormulaModuleService extends MedusaService({
  PricingFormula,
}) {
  /**
   * Create a new pricing formula
   */
  async createFormula(data: {
    name: string;
    description?: string;
    formula_string: string;
    parameters: Record<string, number>;
  }) {
    return await this.createPricingFormulas(data);
  }

  /**
   * Update an existing pricing formula
   */
  async updateFormula(
    id: string,
    data: {
      name?: string;
      description?: string;
      formula_string?: string;
      parameters?: Record<string, number>;
      is_active?: boolean;
    }
  ) {
    return await this.updatePricingFormulas({ id, ...data });
  }

  /**
   * Retrieve a pricing formula by ID
   */
  async retrieveFormula(id: string) {
    return await this.retrievePricingFormula(id);
  }

  /**
   * List all pricing formulas
   */
  async listFormulas(filters?: any) {
    return await this.listPricingFormulas(filters);
  }

  /**
   * Delete a pricing formula
   */
  async deleteFormula(id: string) {
    return await this.deletePricingFormulas(id);
  }

  /**
   * Calculate price using a formula
   * @param formulaId - ID of the formula to use
   * @param variables - Variables to use in calculation (e.g., width_value, length_value, markup)
   * @param volumeMultiplier - Optional volume pricing multiplier (from bulk pricing tiers)
   * @returns Calculated price (rounded down to 2 decimal places)
   */
  async calculatePrice(
    formulaId: string,
    variables: Record<string, number>,
    volumeMultiplier: number = 1.0
  ): Promise<number> {
    const formula = await this.retrieveFormula(formulaId);

    if (!formula || !formula.is_active) {
      throw new Error("Formula not found or inactive");
    }

    // Merge parameters and variables
    const context: Record<string, number> = {
      ...(formula.parameters as Record<string, number>),
      ...variables,
    };

    // Evaluate the formula
    try {
      const basePrice = this.evaluateFormula(formula.formula_string, context);
      
      // Apply volume multiplier to the base price
      // Volume multiplier can be used to adjust price based on quantity tiers
      const finalPrice = basePrice * volumeMultiplier;
      
      // Round down to whole euros for nice pricing (no cents)
      // Math.floor(price) ensures we always round down to nearest euro
      return Math.floor(finalPrice);
    } catch (error: any) {
      throw new Error(`Failed to calculate price: ${error.message}`);
    }
  }

  /**
   * Safely evaluate a formula string with given context
   * @param formulaString - The formula string to evaluate
   * @param context - Variables and parameters for the formula
   * @returns Calculated result
   */
  private evaluateFormula(
    formulaString: string,
    context: Record<string, number>
  ): number {
    // Create a safe evaluation context
    // Only allow mathematical operations and the variables in context
    
    // Validate formula before replacement - allow alphanumeric, underscores, operators, and parentheses
    if (!/^[a-zA-Z0-9_\s+\-*/.()]+$/.test(formulaString)) {
      throw new Error("Formula contains invalid characters");
    }
    
    // Replace variable names in formula with their values
    let processedFormula = formulaString;
    
    for (const [key, value] of Object.entries(context)) {
      // Replace all instances of the variable name with its value
      const regex = new RegExp(`\\b${key}\\b`, "g");
      processedFormula = processedFormula.replace(regex, String(value));
    }

    // After replacement, validate that all variables were replaced (only numbers and operators remain)
    if (!/^[\d\s+\-*/.()]+$/.test(processedFormula)) {
      throw new Error("Formula contains undefined variables or invalid characters after substitution");
    }

    try {
      // Use Function constructor for safe evaluation (only math operations)
      const result = Function(`"use strict"; return (${processedFormula})`)();
      
      if (typeof result !== "number" || isNaN(result)) {
        throw new Error("Formula did not evaluate to a valid number");
      }

      return result;
    } catch (error: any) {
      throw new Error(`Formula evaluation failed: ${error.message}`);
    }
  }

  /**
   * Validate a formula string
   * @param formulaString - Formula to validate
   * @param parameters - Parameters that will be available
   * @returns Validation result
   */
  async validateFormula(
    formulaString: string,
    parameters: Record<string, number>
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      // Test with sample values
      const testContext = {
        ...parameters,
        width_value: 100,
        length_value: 100,
        markup: 0,
        price_per_sqm: 120, // Sample price per square meter
      };

      this.evaluateFormula(formulaString, testContext);
      
      return { valid: true };
    } catch (error: any) {
      return { valid: false, error: error.message };
    }
  }
}

export default PricingFormulaModuleService;


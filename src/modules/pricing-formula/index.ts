import PricingFormulaModuleService from "./service";
import PricingFormula from "./models/pricing-formula";
import { Module } from "@medusajs/framework/utils";

export const PRICING_FORMULA_MODULE = "pricingFormulaModuleService";
export type { PricingFormulaService } from "./types";

export default Module(PRICING_FORMULA_MODULE, {
  service: PricingFormulaModuleService,
});



import { model } from "@medusajs/framework/utils";

const PricingFormula = model.define("pricing_formula", {
  id: model.id().primaryKey(),
  name: model.text(),
  description: model.text().nullable(),
  formula_string: model.text(),
  parameters: model.json(), // Store formula parameters as JSON
  is_active: model.boolean().default(true),
  // created_at, updated_at, and deleted_at are automatically added by MedusaJS
});

export default PricingFormula;



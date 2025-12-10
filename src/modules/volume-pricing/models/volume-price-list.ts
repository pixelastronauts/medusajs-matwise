import { model } from "@medusajs/framework/utils";

/**
 * Volume Price List model
 * 
 * Global/reusable price lists that contain tiered pricing.
 * Can be attached to multiple variants and filtered by customer groups.
 * 
 * Example lists:
 * - "Standard Pricing" (default for all customers)
 * - "B2B Pricing" (for B2B customer groups)
 * - "VIP Pricing" (for VIP customers)
 * - "Premium Material" (higher prices for premium variants)
 */
const VolumePriceList = model.define("volume_price_list", {
  id: model.id().primaryKey(),
  
  // Name of the price list (e.g., "Standard Pricing", "B2B Pricing")
  name: model.text(),
  
  // Description
  description: model.text().nullable(),
  
  // Type: "default" for standard pricing, "customer_group" for group-specific
  // Using text instead of enum for flexibility
  type: model.text().default("default"),
  
  // Status
  status: model.text().default("draft"),
  
  // Start and end dates for time-limited price lists
  starts_at: model.dateTime().nullable(),
  ends_at: model.dateTime().nullable(),
  
  // Customer group IDs (JSON array) - customers in these groups get this pricing
  customer_group_ids: model.json().default({} as Record<string, unknown>),
  
  // Specific customer IDs (JSON array) - specific customers get this pricing
  customer_ids: model.json().default({} as Record<string, unknown>),
  
  // Priority (higher = takes precedence)
  priority: model.number().default(0),
  
  // Currency code
  currency_code: model.text().default("eur"),
});

export default VolumePriceList;

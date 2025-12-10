import { model } from "@medusajs/framework/utils";

/**
 * Volume Price Tier model
 * 
 * Stores tiered pricing for a price list.
 * Tiers belong to a price list and define quantity-based pricing.
 * 
 * The price_per_sqm is stored in cents (e.g., 12000 = €120.00/m²)
 */
const VolumePriceTier = model.define("volume_price_tier", {
  id: model.id().primaryKey(),
  
  // Link to price list (required - tiers belong to a price list)
  price_list_id: model.text(),
  
  // Quantity range (similar to Medusa's native pricing)
  min_quantity: model.number().default(1),
  max_quantity: model.number().nullable(), // null = unlimited
  
  // Price per square meter in cents (e.g., 12000 = €120.00)
  price_per_sqm: model.number(),
  
  // Priority for sorting (lower = higher priority)
  priority: model.number().default(0),
  
  // If true, this tier is hidden for guests (non-logged-in users)
  // The tier will be returned with hidden=true and price masked
  requires_login: model.boolean().default(false),
});

export default VolumePriceTier;

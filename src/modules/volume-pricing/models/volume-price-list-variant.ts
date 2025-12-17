import { model } from "@medusajs/framework/utils";

/**
 * Volume Price List Variant model
 * 
 * Many-to-many link between price lists and product variants.
 * Allows attaching a price list to multiple variants and vice versa.
 */
const VolumePriceListVariant = model.define("volume_price_list_variant", {
  id: model.id().primaryKey(),
  
  // Link to price list
  price_list_id: model.text(),
  
  // Link to variant
  variant_id: model.text(),
});

export default VolumePriceListVariant;




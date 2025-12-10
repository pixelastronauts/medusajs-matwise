import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { VOLUME_PRICING_MODULE, type VolumePricingService } from "../../../../../modules/volume-pricing";

/**
 * GET /store/products/:id/volume-pricing
 * Get volume pricing tiers for a product's variants
 * Automatically uses logged-in customer's groups for customer-specific pricing
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const productModuleService = req.scope.resolve(Modules.PRODUCT);
  const customerModuleService = req.scope.resolve(Modules.CUSTOMER);
  const volumePricingService = req.scope.resolve(VOLUME_PRICING_MODULE) as VolumePricingService;
  
  const { id: productId } = req.params;
  const { variant_id } = req.query as { variant_id?: string };

  try {
    // Get authenticated customer and their groups (if logged in)
    const customerId = (req as any).auth_context?.actor_id;
    let customerGroupIds: string[] = [];

    if (customerId) {
      try {
        const customerGroups = await customerModuleService.listCustomerGroups({
          customers: customerId,
        });
        customerGroupIds = customerGroups.map((g: any) => g.id);
      } catch {
        // Ignore errors fetching groups - just use empty array
      }
    }

    // Get product with variants
    const product = await productModuleService.retrieveProduct(productId, {
      select: ["id", "title"],
      relations: ["variants"],
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Filter to specific variant or get all base variants
    let variantsToCheck = (product.variants || []).filter((v: any) => {
      // Exclude custom variants
      const isCustom = v.metadata?.custom === true || v.metadata?.is_custom_order === true;
      return !isCustom;
    });

    if (variant_id) {
      variantsToCheck = variantsToCheck.filter((v: any) => v.id === variant_id);
    }

    // Get volume pricing for each variant
    const volumePricingByVariant = await Promise.all(
      variantsToCheck.map(async (variant: any) => {
        // Get tiers from new module
        const result = await volumePricingService.getTiersForVariant(variant.id, {
          customerId: customerId,
          customerGroupIds,
          currencyCode: "eur",
        });

        // Fall back to metadata if no module tiers
        if (result.tiers.length === 0) {
          const metadataTiers = (variant.metadata?.volume_pricing_tiers || []) as any[];
          return {
            variant_id: variant.id,
            variant_title: variant.title,
            price_list_id: null,
            price_list_name: null,
            source: metadataTiers.length > 0 ? "metadata" : "none",
            tiers: metadataTiers.map((t: any) => ({
              min_quantity: t.minQty,
              max_quantity: t.maxQty,
              price_per_sqm: t.pricePerSqm,
            })),
          };
        }

        return {
          variant_id: variant.id,
          variant_title: variant.title,
          price_list_id: result.price_list_id,
          price_list_name: result.price_list_name,
          source: "module",
          tiers: result.tiers.map((t: any) => ({
            min_quantity: t.min_quantity,
            max_quantity: t.max_quantity,
            price_per_sqm: t.price_per_sqm_display, // Already in euros
          })),
        };
      })
    );

    res.json({
      product_id: productId,
      product_title: product.title,
      volume_pricing: volumePricingByVariant,
      customer_context: {
        customer_id: customerId || null,
        customer_group_ids: customerGroupIds,
      },
    });
  } catch (error: any) {
    console.error("Error fetching volume pricing:", error);
    res.status(500).json({
      message: "Failed to fetch volume pricing",
      error: error.message,
    });
  }
};


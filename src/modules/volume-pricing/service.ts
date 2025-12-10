import { MedusaService } from "@medusajs/framework/utils";
import { VolumePriceTier, VolumePriceList, VolumePriceListVariant } from "./models";

export type VolumePriceTierDTO = {
  id?: string;
  price_list_id: string;
  min_quantity: number;
  max_quantity?: number | null;
  price_per_sqm: number; // in cents
  priority?: number;
};

export type VolumePriceListDTO = {
  id?: string;
  name: string;
  description?: string | null;
  type?: "default" | "customer_group" | "sale";
  status?: "active" | "draft";
  starts_at?: Date | null;
  ends_at?: Date | null;
  customer_group_ids?: string[];
  customer_ids?: string[];
  priority?: number;
  currency_code?: string;
};

class VolumePricingModuleService extends MedusaService({
  VolumePriceTier,
  VolumePriceList,
  VolumePriceListVariant,
}) {
  // ==================== PRICE LISTS ====================

  /**
   * Create a new price list with tiers
   */
  async createPriceList(data: VolumePriceListDTO & { tiers?: Omit<VolumePriceTierDTO, "price_list_id">[] }) {
    const { tiers, ...listData } = data;
    
    // Cast to any to work around MedusaService generated type constraints
    const priceList = await (this.createVolumePriceLists as any)({
      ...listData,
      type: listData.type || "default",
      status: listData.status || "draft",
      customer_group_ids: listData.customer_group_ids || [],
      customer_ids: listData.customer_ids || [],
      priority: listData.priority || 0,
      currency_code: listData.currency_code || "eur",
    });

    // Create tiers if provided
    if (tiers && tiers.length > 0) {
      await this.createVolumePriceTiers(
        tiers.map((tier, index) => ({
          ...tier,
          price_list_id: priceList.id,
          priority: tier.priority ?? index,
        }))
      );
    }

    return priceList;
  }

  /**
   * Update a price list
   */
  async updatePriceList(id: string, data: Partial<VolumePriceListDTO>) {
    // Cast to any to work around MedusaService generated type constraints
    return await (this.updateVolumePriceLists as any)({ id, ...data });
  }

  /**
   * Delete a price list and all its tiers and variant links
   */
  async deletePriceList(id: string) {
    // Delete tiers
    const tiers = await this.listVolumePriceTiers({ price_list_id: id });
    if (tiers.length > 0) {
      await this.deleteVolumePriceTiers(tiers.map((t: any) => t.id));
    }

    // Delete variant links
    const variantLinks = await this.listVolumePriceListVariants({ price_list_id: id });
    if (variantLinks.length > 0) {
      await this.deleteVolumePriceListVariants(variantLinks.map((v: any) => v.id));
    }

    // Delete the price list
    return await this.deleteVolumePriceLists(id);
  }

  /**
   * Get a price list by ID with its tiers
   */
  async getPriceListWithTiers(id: string) {
    const priceList = await this.retrieveVolumePriceList(id);
    const tiers = await this.listVolumePriceTiers(
      { price_list_id: id },
      { order: { min_quantity: "ASC" } }
    );

    return {
      ...priceList,
      tiers: tiers.map((tier: any) => ({
        ...tier,
        price_per_sqm_display: Number(tier.price_per_sqm) / 100,
      })),
    };
  }

  /**
   * List all price lists
   */
  async listPriceLists(filters?: any) {
    return await this.listVolumePriceLists(filters, {
      order: { priority: "DESC", created_at: "DESC" },
    });
  }

  // ==================== PRICE TIERS ====================

  /**
   * Set tiers for a price list (replaces all existing)
   */
  async setTiersForPriceList(
    priceListId: string,
    tiers: Omit<VolumePriceTierDTO, "price_list_id">[]
  ) {
    // Delete existing tiers
    const existingTiers = await this.listVolumePriceTiers({ price_list_id: priceListId });
    if (existingTiers.length > 0) {
      await this.deleteVolumePriceTiers(existingTiers.map((t: any) => t.id));
    }

    // Create new tiers
    if (tiers.length === 0) {
      return [];
    }

    return await this.createVolumePriceTiers(
      tiers.map((tier, index) => ({
        ...tier,
        price_list_id: priceListId,
        priority: tier.priority ?? index,
      }))
    );
  }

  /**
   * Get tiers for a price list
   */
  async getTiersForPriceList(priceListId: string) {
    return await this.listVolumePriceTiers(
      { price_list_id: priceListId },
      { order: { min_quantity: "ASC" } }
    );
  }

  // ==================== VARIANT LINKS ====================

  /**
   * Attach a price list to variants
   */
  async attachVariantsToPriceList(priceListId: string, variantIds: string[]) {
    // Get existing links
    const existingLinks = await this.listVolumePriceListVariants({ price_list_id: priceListId });
    const existingVariantIds = existingLinks.map((l: any) => l.variant_id);

    // Filter out already linked variants
    const newVariantIds = variantIds.filter((id) => !existingVariantIds.includes(id));

    if (newVariantIds.length === 0) {
      return existingLinks;
    }

    // Create new links
    await this.createVolumePriceListVariants(
      newVariantIds.map((variantId) => ({
        price_list_id: priceListId,
        variant_id: variantId,
      }))
    );

    return await this.listVolumePriceListVariants({ price_list_id: priceListId });
  }

  /**
   * Detach variants from a price list
   */
  async detachVariantsFromPriceList(priceListId: string, variantIds: string[]) {
    const links = await this.listVolumePriceListVariants({
      price_list_id: priceListId,
      variant_id: variantIds,
    });

    if (links.length > 0) {
      await this.deleteVolumePriceListVariants(links.map((l: any) => l.id));
    }

    return await this.listVolumePriceListVariants({ price_list_id: priceListId });
  }

  /**
   * Set variants for a price list (replaces all)
   */
  async setVariantsForPriceList(priceListId: string, variantIds: string[]) {
    // Delete all existing links
    const existingLinks = await this.listVolumePriceListVariants({ price_list_id: priceListId });
    if (existingLinks.length > 0) {
      await this.deleteVolumePriceListVariants(existingLinks.map((l: any) => l.id));
    }

    // Create new links
    if (variantIds.length === 0) {
      return [];
    }

    return await this.createVolumePriceListVariants(
      variantIds.map((variantId) => ({
        price_list_id: priceListId,
        variant_id: variantId,
      }))
    );
  }

  /**
   * Get all variants linked to a price list
   */
  async getVariantsForPriceList(priceListId: string) {
    const links = await this.listVolumePriceListVariants({ price_list_id: priceListId });
    return links.map((l: any) => l.variant_id);
  }

  /**
   * Get all price lists linked to a variant
   */
  async getPriceListsForVariant(variantId: string) {
    const links = await this.listVolumePriceListVariants({ variant_id: variantId });
    const priceListIds = links.map((l: any) => l.price_list_id);

    if (priceListIds.length === 0) {
      return [];
    }

    return await this.listVolumePriceLists({ id: priceListIds });
  }

  // ==================== PRICE CALCULATION ====================

  /**
   * Find the applicable price per sqm for a variant and quantity
   */
  async findApplicablePricePerSqm(
    variantId: string,
    quantity: number,
    options?: {
      customerId?: string;
      customerGroupIds?: string[];
      currencyCode?: string;
    }
  ): Promise<{ price_per_sqm: number; price_list_id: string; price_list_name: string } | null> {
    const currencyCode = options?.currencyCode || "eur";
    const now = new Date();

    // Get all price lists linked to this variant
    const variantLinks = await this.listVolumePriceListVariants({ variant_id: variantId });
    const linkedPriceListIds = variantLinks.map((l: any) => l.price_list_id);

    if (linkedPriceListIds.length === 0) {
      return null;
    }

    // Get all linked price lists that are active
    const priceLists = await this.listVolumePriceLists(
      {
        id: linkedPriceListIds,
        status: "active",
        currency_code: currencyCode,
      },
      { order: { priority: "DESC" } }
    );

    // Filter by date validity and customer eligibility
    const eligiblePriceLists = priceLists.filter((pl: any) => {
      // Check date validity
      if (pl.starts_at && new Date(pl.starts_at) > now) return false;
      if (pl.ends_at && new Date(pl.ends_at) < now) return false;

      // If it's a default price list, it's always eligible
      if (pl.type === "default") return true;

      // Check customer group membership
      if (pl.type === "customer_group" || pl.type === "sale") {
        const listGroupIds = (pl.customer_group_ids as string[]) || [];
        const listCustomerIds = (pl.customer_ids as string[]) || [];

        // If no customer filters set, it applies to all
        if (listGroupIds.length === 0 && listCustomerIds.length === 0) {
          return true;
        }

        // Check if customer matches
        if (options?.customerId && listCustomerIds.includes(options.customerId)) {
          return true;
        }

        // Check if customer is in any of the groups
        if (options?.customerGroupIds && options.customerGroupIds.some((gid) => listGroupIds.includes(gid))) {
          return true;
        }

        return false;
      }

      return true;
    });

    // Sort eligible price lists: 
    // 1. By priority (DESC)
    // 2. By type: customer_group/sale before default (when priorities are equal)
    eligiblePriceLists.sort((a: any, b: any) => {
      // First sort by priority (higher = first)
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      // When priorities are equal, customer_group/sale types come before default
      const typeOrder = { customer_group: 0, sale: 1, default: 2 };
      const aOrder = typeOrder[a.type as keyof typeof typeOrder] ?? 2;
      const bOrder = typeOrder[b.type as keyof typeof typeOrder] ?? 2;
      return aOrder - bOrder;
    });

    // Find the first price list that has a matching tier for the quantity
    for (const priceList of eligiblePriceLists) {
      const tiers = await this.listVolumePriceTiers(
        { price_list_id: priceList.id },
        { order: { min_quantity: "ASC" } }
      );

      // Find matching tier
      const matchingTier = tiers.find((tier: any) => {
        const minQty = tier.min_quantity || 1;
        const maxQty = tier.max_quantity;

        if (maxQty === null || maxQty === undefined) {
          return quantity >= minQty;
        }
        return quantity >= minQty && quantity <= maxQty;
      });

      if (matchingTier) {
        return {
          price_per_sqm: Number(matchingTier.price_per_sqm),
          price_list_id: priceList.id,
          price_list_name: priceList.name,
        };
      }
    }

    return null;
  }

  // ==================== STOREFRONT HELPERS ====================

  /**
   * Get all tiers for a variant from its linked price lists
   * Returns tiers from the highest priority active default price list
   * Used by storefront for displaying tier options
   */
  async getTiersForVariant(
    variantId: string,
    options?: {
      customerId?: string;
      customerGroupIds?: string[];
      currencyCode?: string;
    }
  ): Promise<{ tiers: any[]; price_list_id: string | null; price_list_name: string | null }> {
    const currencyCode = options?.currencyCode || "eur";
    const now = new Date();

    // Get all price lists linked to this variant
    const variantLinks = await this.listVolumePriceListVariants({ variant_id: variantId });
    const linkedPriceListIds = variantLinks.map((l: any) => l.price_list_id);

    if (linkedPriceListIds.length === 0) {
      return { tiers: [], price_list_id: null, price_list_name: null };
    }

    // Get all linked price lists that are active
    const priceLists = await this.listVolumePriceLists(
      {
        id: linkedPriceListIds,
        status: "active",
      },
      { order: { priority: "DESC" } }
    );

    // Filter by date validity and customer eligibility
    const eligiblePriceLists = priceLists.filter((pl: any) => {
      // Check date validity
      if (pl.starts_at && new Date(pl.starts_at) > now) return false;
      if (pl.ends_at && new Date(pl.ends_at) < now) return false;

      // If it's a default price list with no customer restrictions, it's eligible
      if (pl.type === "default") {
        const hasCustomerRestrictions =
          (pl.customer_group_ids?.length > 0) || (pl.customer_ids?.length > 0);
        if (!hasCustomerRestrictions) return true;
      }

      // Check customer membership for restricted lists
      const listGroupIds = (pl.customer_group_ids as string[]) || [];
      const listCustomerIds = (pl.customer_ids as string[]) || [];

      // If no customer filters set, it applies to all
      if (listGroupIds.length === 0 && listCustomerIds.length === 0) {
        return true;
      }

      // Check if customer matches
      if (options?.customerId && listCustomerIds.includes(options.customerId)) {
        return true;
      }

      // Check if customer is in any of the groups
      if (options?.customerGroupIds && options.customerGroupIds.some((gid) => listGroupIds.includes(gid))) {
        return true;
      }

      return false;
    });

    // Sort eligible price lists: 
    // 1. By priority (DESC)
    // 2. By type: customer_group/sale before default (when priorities are equal)
    eligiblePriceLists.sort((a: any, b: any) => {
      // First sort by priority (higher = first)
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      // When priorities are equal, customer_group/sale types come before default
      const typeOrder = { customer_group: 0, sale: 1, default: 2 };
      const aOrder = typeOrder[a.type as keyof typeof typeOrder] ?? 2;
      const bOrder = typeOrder[b.type as keyof typeof typeOrder] ?? 2;
      return aOrder - bOrder;
    });

    // Return tiers from the first (highest priority) eligible price list
    if (eligiblePriceLists.length > 0) {
      const priceList = eligiblePriceLists[0];
      const tiers = await this.listVolumePriceTiers(
        { price_list_id: priceList.id },
        { order: { min_quantity: "ASC" } }
      );

      return {
        tiers: tiers.map((tier: any) => ({
          id: tier.id,
          min_quantity: tier.min_quantity,
          max_quantity: tier.max_quantity,
          price_per_sqm: Number(tier.price_per_sqm), // In cents
          price_per_sqm_display: Number(tier.price_per_sqm) / 100, // In euros
        })),
        price_list_id: priceList.id,
        price_list_name: priceList.name,
      };
    }

    return { tiers: [], price_list_id: null, price_list_name: null };
  }

  /**
   * Get all tiers for a variant for a specific price list ID
   */
  async getTiersForPriceListAndVariant(priceListId: string, variantId: string) {
    // Check if variant is linked to this price list
    const links = await this.listVolumePriceListVariants({
      price_list_id: priceListId,
      variant_id: variantId,
    });

    if (links.length === 0) {
      return [];
    }

    const tiers = await this.listVolumePriceTiers(
      { price_list_id: priceListId },
      { order: { min_quantity: "ASC" } }
    );

    return tiers.map((tier: any) => ({
      id: tier.id,
      min_quantity: tier.min_quantity,
      max_quantity: tier.max_quantity,
      price_per_sqm: Number(tier.price_per_sqm),
      price_per_sqm_display: Number(tier.price_per_sqm) / 100,
    }));
  }

  // ==================== MIGRATION HELPERS ====================

  /**
   * Migrate from metadata-based volume pricing
   * Creates a default price list for each unique tier configuration
   */
  async migrateFromMetadata(
    variantId: string,
    metadataTiers: { minQty: number; maxQty: number | null; pricePerSqm: number }[],
    priceListName?: string
  ) {
    // Create a new price list for this variant's tiers
    const priceList = await this.createPriceList({
      name: priceListName || `Migrated Pricing (${variantId.slice(-6)})`,
      description: "Migrated from variant metadata",
      type: "default",
      status: "active",
      tiers: metadataTiers.map((tier, index) => ({
        min_quantity: tier.minQty,
        max_quantity: tier.maxQty,
        price_per_sqm: Math.round(tier.pricePerSqm * 100), // Convert to cents
        priority: index,
      })),
    });

    // Link the variant to this price list
    await this.attachVariantsToPriceList(priceList.id, [variantId]);

    return priceList;
  }
}

export default VolumePricingModuleService;

export type VolumePriceTierData = {
  id?: string;
  variant_id: string;
  price_list_id?: string | null;
  min_quantity: number;
  max_quantity?: number | null;
  price_per_sqm: number; // in cents
  currency_code?: string;
  priority?: number;
};

export type VolumePriceListData = {
  id?: string;
  name: string;
  description?: string | null;
  type?: "sale" | "override";
  status?: "active" | "draft";
  starts_at?: Date | null;
  ends_at?: Date | null;
  customer_group_ids?: string[];
  customer_ids?: string[];
  priority?: number;
};


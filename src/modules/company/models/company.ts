import { model } from "@medusajs/framework/utils";
import { Employee } from "./employee";

export const Company = model.define("company", {
  id: model
    .id({
      prefix: "comp",
    })
    .primaryKey(),
  name: model.text(),
  email: model.text(),
  phone: model.text().nullable(),
  address: model.text().nullable(),
  city: model.text().nullable(),
  state: model.text().nullable(),
  zip: model.text().nullable(),
  country: model.text().nullable(),
  logo_url: model.text().nullable(),
  currency_code: model.text().nullable(),
  vat_number: model.text().nullable(),
  vat_validated: model.boolean().default(false),
  // VAT validation details from registry
  vat_country_code: model.text().nullable(),
  vat_company_name: model.text().nullable(),
  vat_company_address: model.text().nullable(),
  vat_validated_at: model.dateTime().nullable(),
  spending_limit_reset_frequency: model
    .enum(["never", "daily", "weekly", "monthly", "yearly"])
    .default("monthly"),
  metadata: model.json().nullable(),
  employees: model.hasMany(() => Employee, {
    mappedBy: "company",
  }),
});


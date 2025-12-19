import { Migration } from "@mikro-orm/migrations";

export class Migration20251208000003 extends Migration {
  async up(): Promise<void> {
    // Add VAT validation detail columns to company table
    this.addSql(`
      ALTER TABLE "company" 
      ADD COLUMN IF NOT EXISTS "vat_country_code" text,
      ADD COLUMN IF NOT EXISTS "vat_company_name" text,
      ADD COLUMN IF NOT EXISTS "vat_company_address" text,
      ADD COLUMN IF NOT EXISTS "vat_validated_at" timestamptz;
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      ALTER TABLE "company" 
      DROP COLUMN IF EXISTS "vat_country_code",
      DROP COLUMN IF EXISTS "vat_company_name",
      DROP COLUMN IF EXISTS "vat_company_address",
      DROP COLUMN IF EXISTS "vat_validated_at";
    `);
  }
}





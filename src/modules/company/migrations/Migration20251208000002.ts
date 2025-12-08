import { Migration } from "@mikro-orm/migrations";

export class Migration20251208000002 extends Migration {
  async up(): Promise<void> {
    // Add vat_number and vat_validated columns to company table
    this.addSql(`
      ALTER TABLE "company" 
      ADD COLUMN IF NOT EXISTS "vat_number" text,
      ADD COLUMN IF NOT EXISTS "vat_validated" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "vat_country_code" text,
      ADD COLUMN IF NOT EXISTS "vat_company_name" text,
      ADD COLUMN IF NOT EXISTS "vat_company_address" text,
      ADD COLUMN IF NOT EXISTS "vat_validated_at" timestamptz;
    `);

    // Create index on vat_number for faster lookups
    this.addSql(`
      CREATE INDEX IF NOT EXISTS "IDX_company_vat_number" ON "company" ("vat_number");
    `);
  }

  async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_company_vat_number";`);
    this.addSql(`
      ALTER TABLE "company" 
      DROP COLUMN IF EXISTS "vat_number",
      DROP COLUMN IF EXISTS "vat_validated",
      DROP COLUMN IF EXISTS "vat_country_code",
      DROP COLUMN IF EXISTS "vat_company_name",
      DROP COLUMN IF EXISTS "vat_company_address",
      DROP COLUMN IF EXISTS "vat_validated_at";
    `);
  }
}


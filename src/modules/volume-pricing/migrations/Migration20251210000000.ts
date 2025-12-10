import { Migration } from "@mikro-orm/migrations";

export class Migration20251210000000 extends Migration {
  async up(): Promise<void> {
    // Create volume_price_list table (global price lists)
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "volume_price_list" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "name" TEXT NOT NULL,
        "description" TEXT,
        "type" TEXT NOT NULL DEFAULT 'default',
        "status" TEXT NOT NULL DEFAULT 'draft',
        "starts_at" TIMESTAMPTZ,
        "ends_at" TIMESTAMPTZ,
        "customer_group_ids" JSONB NOT NULL DEFAULT '[]',
        "customer_ids" JSONB NOT NULL DEFAULT '[]',
        "priority" INTEGER NOT NULL DEFAULT 0,
        "currency_code" TEXT NOT NULL DEFAULT 'eur',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ
      );
    `);

    // Create volume_price_tier table (tiers belong to price lists)
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "volume_price_tier" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "price_list_id" TEXT NOT NULL REFERENCES "volume_price_list"("id") ON DELETE CASCADE,
        "min_quantity" INTEGER NOT NULL DEFAULT 1,
        "max_quantity" INTEGER,
        "price_per_sqm" NUMERIC NOT NULL,
        "priority" INTEGER NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ
      );
    `);

    // Create volume_price_list_variant table (many-to-many link)
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "volume_price_list_variant" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "price_list_id" TEXT NOT NULL REFERENCES "volume_price_list"("id") ON DELETE CASCADE,
        "variant_id" TEXT NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ,
        UNIQUE("price_list_id", "variant_id")
      );
    `);

    // Create indexes
    this.addSql(`
      CREATE INDEX IF NOT EXISTS "idx_volume_price_tier_price_list_id" 
      ON "volume_price_tier" ("price_list_id");
    `);

    this.addSql(`
      CREATE INDEX IF NOT EXISTS "idx_volume_price_list_variant_price_list_id" 
      ON "volume_price_list_variant" ("price_list_id");
    `);

    this.addSql(`
      CREATE INDEX IF NOT EXISTS "idx_volume_price_list_variant_variant_id" 
      ON "volume_price_list_variant" ("variant_id");
    `);

    this.addSql(`
      CREATE INDEX IF NOT EXISTS "idx_volume_price_list_status" 
      ON "volume_price_list" ("status");
    `);

    this.addSql(`
      CREATE INDEX IF NOT EXISTS "idx_volume_price_list_type" 
      ON "volume_price_list" ("type");
    `);
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "volume_price_list_variant";`);
    this.addSql(`DROP TABLE IF EXISTS "volume_price_tier";`);
    this.addSql(`DROP TABLE IF EXISTS "volume_price_list";`);
  }
}

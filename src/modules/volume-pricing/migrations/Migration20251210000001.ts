import { Migration } from "@mikro-orm/migrations";

export class Migration20251210000001 extends Migration {
  async up(): Promise<void> {
    // Check if tables exist and update them, or create new ones
    
    // First, drop the old volume_price_tier table if it has variant_id column
    // and recreate with new structure
    this.addSql(`
      DO $$
      BEGIN
        -- Check if variant_id column exists in volume_price_tier
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'volume_price_tier' AND column_name = 'variant_id'
        ) THEN
          -- Drop the old table
          DROP TABLE IF EXISTS "volume_price_tier" CASCADE;
        END IF;
      END $$;
    `);

    // Ensure volume_price_list table exists with correct structure
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

    // Add currency_code column if it doesn't exist
    this.addSql(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'volume_price_list' AND column_name = 'currency_code'
        ) THEN
          ALTER TABLE "volume_price_list" ADD COLUMN "currency_code" TEXT NOT NULL DEFAULT 'eur';
        END IF;
      END $$;
    `);

    // Create volume_price_tier table with new structure (belongs to price_list, not variant)
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "volume_price_tier" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "price_list_id" TEXT NOT NULL,
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
        "price_list_id" TEXT NOT NULL,
        "variant_id" TEXT NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ
      );
    `);

    // Add unique constraint for price_list_variant
    this.addSql(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'volume_price_list_variant_unique'
        ) THEN
          ALTER TABLE "volume_price_list_variant" 
          ADD CONSTRAINT "volume_price_list_variant_unique" UNIQUE("price_list_id", "variant_id");
        END IF;
      END $$;
    `);

    // Create indexes
    this.addSql(`CREATE INDEX IF NOT EXISTS "idx_volume_price_tier_price_list_id" ON "volume_price_tier" ("price_list_id");`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "idx_volume_price_list_variant_price_list_id" ON "volume_price_list_variant" ("price_list_id");`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "idx_volume_price_list_variant_variant_id" ON "volume_price_list_variant" ("variant_id");`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "idx_volume_price_list_status" ON "volume_price_list" ("status");`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "idx_volume_price_list_type" ON "volume_price_list" ("type");`);
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "volume_price_list_variant";`);
    this.addSql(`DROP TABLE IF EXISTS "volume_price_tier";`);
    this.addSql(`DROP TABLE IF EXISTS "volume_price_list";`);
  }
}


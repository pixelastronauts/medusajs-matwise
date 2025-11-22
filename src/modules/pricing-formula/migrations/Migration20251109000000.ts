import { Migration } from "@mikro-orm/migrations";

export class Migration20251109000000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "pricing_formula" (
        "id" text NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "formula_string" text NOT NULL,
        "parameters" jsonb NOT NULL DEFAULT '{}',
        "is_active" boolean NOT NULL DEFAULT true,
        "deleted_at" timestamp with time zone,
        "created_at" timestamp with time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
        CONSTRAINT "pricing_formula_pkey" PRIMARY KEY ("id")
      );
    `);

    this.addSql(`
      CREATE INDEX IF NOT EXISTS "IDX_pricing_formula_is_active" ON "pricing_formula" ("is_active");
    `);
    
    this.addSql(`
      CREATE INDEX IF NOT EXISTS "IDX_pricing_formula_deleted_at" ON "pricing_formula" ("deleted_at");
    `);
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "pricing_formula" CASCADE;`);
  }
}



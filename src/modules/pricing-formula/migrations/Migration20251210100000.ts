import { Migration } from "@mikro-orm/migrations";

export class Migration20251210100000 extends Migration {
  async up(): Promise<void> {
    // Add is_default column to pricing_formula table
    this.addSql(`
      ALTER TABLE "pricing_formula"
      ADD COLUMN IF NOT EXISTS "is_default" boolean NOT NULL DEFAULT false;
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      ALTER TABLE "pricing_formula"
      DROP COLUMN IF EXISTS "is_default";
    `);
  }
}





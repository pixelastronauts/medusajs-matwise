import { Migration } from "@mikro-orm/migrations";

export class Migration20251210000004 extends Migration {
  async up(): Promise<void> {
    // Add requires_login column to volume_price_tier
    this.addSql(`
      ALTER TABLE "volume_price_tier" 
      ADD COLUMN IF NOT EXISTS "requires_login" BOOLEAN NOT NULL DEFAULT false;
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      ALTER TABLE "volume_price_tier" 
      DROP COLUMN IF EXISTS "requires_login";
    `);
  }
}








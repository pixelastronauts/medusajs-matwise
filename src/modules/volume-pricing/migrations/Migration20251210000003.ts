import { Migration } from "@mikro-orm/migrations";

export class Migration20251210000003 extends Migration {
  async up(): Promise<void> {
    // Ensure price_per_sqm is an integer type (stores cents)
    this.addSql(`
      ALTER TABLE "volume_price_tier" 
      ALTER COLUMN "price_per_sqm" TYPE INTEGER USING "price_per_sqm"::INTEGER;
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      ALTER TABLE "volume_price_tier" 
      ALTER COLUMN "price_per_sqm" TYPE NUMERIC;
    `);
  }
}


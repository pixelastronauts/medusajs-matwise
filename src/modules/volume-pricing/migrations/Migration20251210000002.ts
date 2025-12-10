import { Migration } from "@mikro-orm/migrations";

export class Migration20251210000002 extends Migration {
  async up(): Promise<void> {
    // Convert type and status columns from enum to text for flexibility
    this.addSql(`
      ALTER TABLE "volume_price_list" 
      ALTER COLUMN "type" TYPE TEXT USING "type"::TEXT,
      ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;
    `);
    
    // Update old values to new ones
    this.addSql(`
      UPDATE "volume_price_list" 
      SET "type" = 'default' 
      WHERE "type" = 'override' OR "type" IS NULL;
    `);
  }

  async down(): Promise<void> {
    // No down migration needed
  }
}


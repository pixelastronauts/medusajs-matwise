import { Migration } from "@mikro-orm/migrations";

export class Migration20251219000000 extends Migration {
  async up(): Promise<void> {
    // Add metadata column to company table
    this.addSql(`
      ALTER TABLE "company" 
      ADD COLUMN IF NOT EXISTS "metadata" jsonb;
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      ALTER TABLE "company" 
      DROP COLUMN IF EXISTS "metadata";
    `);
  }
}





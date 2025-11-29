import { Migration } from '@mikro-orm/migrations';

export class Migration20251127120000 extends Migration {

  override async up(): Promise<void> {
    // Add raw_amount column if it doesn't exist (required by bigNumber type)
    this.addSql(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='invoice' AND column_name='raw_amount'
        ) THEN
          ALTER TABLE "invoice" ADD COLUMN "raw_amount" jsonb NULL;
        END IF;
      END $$;
    `);
    
    // Ensure amount column exists and is nullable
    this.addSql(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='invoice' AND column_name='amount'
        ) THEN
          ALTER TABLE "invoice" ADD COLUMN "amount" numeric NULL;
        ELSE
          ALTER TABLE "invoice" ALTER COLUMN "amount" DROP NOT NULL;
        END IF;
      END $$;
    `);
  }

  override async down(): Promise<void> {
    // This migration just ensures columns exist, no need to revert
  }

}



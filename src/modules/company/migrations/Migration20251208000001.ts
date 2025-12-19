import { Migration } from "@mikro-orm/migrations";

export class Migration20251208000001 extends Migration {
  async up(): Promise<void> {
    // Drop the old tables and recreate with correct schema
    // This is needed because the initial migration used bigNumber which requires raw_ columns
    this.addSql(`DROP TABLE IF EXISTS "employee" CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "company" CASCADE;`);

    // Recreate company table
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "company" (
        "id" text NOT NULL,
        "name" text NOT NULL,
        "email" text NOT NULL,
        "phone" text,
        "address" text,
        "city" text,
        "state" text,
        "zip" text,
        "country" text,
        "logo_url" text,
        "currency_code" text,
        "spending_limit_reset_frequency" text NOT NULL DEFAULT 'monthly',
        "deleted_at" timestamp with time zone,
        "created_at" timestamp with time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
        CONSTRAINT "company_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "company_spending_limit_reset_frequency_check" CHECK ("spending_limit_reset_frequency" IN ('never', 'daily', 'weekly', 'monthly', 'yearly'))
      );
    `);

    // Recreate employee table with number type for spending_limit (not bigNumber)
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "employee" (
        "id" text NOT NULL,
        "customer_id" text NOT NULL,
        "company_id" text NOT NULL,
        "role" text NOT NULL DEFAULT 'member',
        "spending_limit" integer,
        "is_active" boolean NOT NULL DEFAULT true,
        "deleted_at" timestamp with time zone,
        "created_at" timestamp with time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
        CONSTRAINT "employee_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "employee_role_check" CHECK ("role" IN ('admin', 'member')),
        CONSTRAINT "employee_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company" ("id") ON DELETE CASCADE
      );
    `);

    // Create indexes
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_company_deleted_at" ON "company" ("deleted_at");`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_company_email" ON "company" ("email");`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_employee_deleted_at" ON "employee" ("deleted_at");`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_employee_customer_id" ON "employee" ("customer_id");`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_employee_company_id" ON "employee" ("company_id");`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_employee_is_active" ON "employee" ("is_active");`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_employee_customer_unique" ON "employee" ("customer_id") WHERE "deleted_at" IS NULL;`);
  }

  async down(): Promise<void> {
    // No rollback - this is a fix migration
  }
}





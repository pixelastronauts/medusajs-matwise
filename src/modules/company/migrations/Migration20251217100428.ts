import { Migration } from "@mikro-orm/migrations";

export class Migration20251217100428 extends Migration {
  async up(): Promise<void> {
    // Update employee role constraint to include new role values (manager, employee)
    // while keeping backward compatibility with old values (admin, member)
    this.addSql(`
      ALTER TABLE "employee" 
      DROP CONSTRAINT IF EXISTS "employee_role_check";
    `);

    this.addSql(`
      ALTER TABLE "employee"
      ADD CONSTRAINT "employee_role_check" 
      CHECK ("role" IN ('manager', 'employee', 'admin', 'member'));
    `);
  }

  async down(): Promise<void> {
    // Revert to old constraint
    this.addSql(`
      ALTER TABLE "employee" 
      DROP CONSTRAINT IF EXISTS "employee_role_check";
    `);

    this.addSql(`
      ALTER TABLE "employee"
      ADD CONSTRAINT "employee_role_check" 
      CHECK ("role" IN ('admin', 'member'));
    `);
  }
}






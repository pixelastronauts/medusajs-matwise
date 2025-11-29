import { Migration } from '@mikro-orm/migrations';

export class Migration20251127000000 extends Migration {

  override async up(): Promise<void> {
    // Add new columns
    this.addSql(`alter table if exists "invoice" add column if not exists "type" text check ("type" in ('invoice', 'credit_note')) not null default 'invoice';`);
    this.addSql(`alter table if exists "invoice" add column if not exists "refund_id" text null;`);
    
    // bigNumber creates both raw_amount (numeric) and amount (numeric) columns
    this.addSql(`alter table if exists "invoice" add column if not exists "raw_amount" jsonb null;`);
    this.addSql(`alter table if exists "invoice" add column if not exists "amount" numeric null;`);
    
    // Migrate existing data: update amount from pdfContent if possible, otherwise leave as 0
    // Set all existing invoices to type 'invoice'
    this.addSql(`update "invoice" set "type" = 'invoice' where "type" is null;`);
    
    // Drop the old status column
    this.addSql(`alter table if exists "invoice" drop column if exists "status";`);
  }

  override async down(): Promise<void> {
    // Restore status column
    this.addSql(`alter table if exists "invoice" add column if not exists "status" text check ("status" in ('latest', 'stale')) not null default 'latest';`);
    
    // Drop new columns
    this.addSql(`alter table if exists "invoice" drop column if exists "type";`);
    this.addSql(`alter table if exists "invoice" drop column if exists "refund_id";`);
    this.addSql(`alter table if exists "invoice" drop column if exists "raw_amount";`);
    this.addSql(`alter table if exists "invoice" drop column if exists "amount";`);
  }

}


import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const execAsync = promisify(exec);

// POST /admin/database-sync - Sync database from production
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const isDevelopment = process.env.NODE_ENV !== "production";

    if (!isDevelopment) {
      return res.status(403).json({
        message: "Database sync is only available in development environments",
      });
    }

    const { tables, anonymize = true } = req.body as {
      tables?: string[];
      anonymize?: boolean;
    };

    // Check environment variables
    const prodDbUrl = process.env.PROD_DATABASE_URL;
    const devDbUrl = process.env.DATABASE_URL;

    if (!prodDbUrl) {
      return res.status(400).json({
        message: "PROD_DATABASE_URL environment variable is not configured",
      });
    }

    if (!devDbUrl) {
      return res.status(400).json({
        message: "DATABASE_URL environment variable is not configured",
      });
    }

    // Generate temp file for SQL dump
    const dumpFile = join(tmpdir(), `medusa_sync_${Date.now()}.sql`);

    try {
      // Build pg_dump command
      let dumpCommand = `pg_dump "${prodDbUrl}" --no-owner --no-acl --clean --if-exists`;
      
      // Add table filters if specified
      if (tables && tables.length > 0) {
        const tableArgs = tables.map(t => `-t public.${t}`).join(" ");
        dumpCommand += ` ${tableArgs}`;
      }
      
      dumpCommand += ` -f "${dumpFile}"`;

      console.log("📦 Dumping production database...");
      await execAsync(dumpCommand);

      console.log("🔧 Restoring to development database...");
      await execAsync(`psql "${devDbUrl}" -f "${dumpFile}"`);

      // Anonymize sensitive data if requested
      if (anonymize) {
        console.log("🔒 Anonymizing sensitive data...");
        const { Client } = await import("pg");
        const client = new Client({ connectionString: devDbUrl });
        
        await client.connect();

        // Anonymize customer data
        try {
          await client.query(`
            UPDATE customer 
            SET 
              email = 'dev+' || id || '@example.com',
              phone = NULL
            WHERE email NOT LIKE 'dev+%@example.com';
          `);

          // Clear payment sessions (sensitive payment data)
          await client.query(`TRUNCATE payment_session CASCADE;`);

          console.log("✅ Anonymization complete");
        } catch (err) {
          console.warn("⚠️  Anonymization skipped (tables may not exist):", err);
        }

        await client.end();
      }

      // Clean up temp file
      await unlink(dumpFile);

      const tableCount = tables?.length || "all";
      console.log(`✨ Sync complete! Synced ${tableCount} table${tableCount !== 1 ? 's' : ''}`);

      res.json({
        success: true,
        tables_synced: tables?.length || 0,
        total_tables: tables?.length || 0,
        anonymized: anonymize,
      });
    } catch (syncError: any) {
      // Clean up temp file on error
      try {
        await unlink(dumpFile);
      } catch {}

      throw syncError;
    }
  } catch (error: any) {
    console.error("Error syncing database:", error);
    res.status(500).json({
      message: "Failed to sync database",
      error: error.message,
    });
  }
}





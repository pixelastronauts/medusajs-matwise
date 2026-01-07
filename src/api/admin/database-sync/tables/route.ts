import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

// GET /admin/database-sync/tables - Get list of tables from production
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const isDevelopment = process.env.NODE_ENV !== "production";

    if (!isDevelopment) {
      return res.status(403).json({
        message: "Database sync is only available in development environments",
      });
    }

    // Check if production database URL is configured
    const prodDbUrl = process.env.PROD_DATABASE_URL;
    if (!prodDbUrl) {
      return res.status(400).json({
        message: "PROD_DATABASE_URL environment variable is not configured",
      });
    }

    // Get list of tables from production database
    const { Client } = await import("pg");
    const client = new Client({ connectionString: prodDbUrl });
    
    await client.connect();

    // Get tables with row counts and sizes
    const result = await client.query(`
      SELECT 
        schemaname,
        relname as name,
        n_live_tup as row_count,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) as size
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      ORDER BY relname;
    `);

    await client.end();

    res.json({
      is_development: isDevelopment,
      tables: result.rows,
    });
  } catch (error: any) {
    console.error("Error fetching production tables:", error);
    res.status(500).json({
      message: "Failed to fetch production database tables",
      error: error.message,
    });
  }
}


import type { MedusaRequest, MedusaResponse } from "@medusajs/medusa"
import cleanupOldVariantsHandler from "../../../jobs/cleanup-old-variants"

/**
 * Test endpoint to manually trigger the cleanup job
 * GET /admin/test-cleanup-job
 */
export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  try {
    // Run the cleanup job
    await cleanupOldVariantsHandler(req.scope)
    
    res.json({
      message: "Cleanup job executed successfully",
      status: "success"
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    res.status(500).json({
      message: "Error running cleanup job",
      error: errorMessage
    })
  }
}


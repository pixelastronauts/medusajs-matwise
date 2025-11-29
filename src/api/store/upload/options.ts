import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

// OPTIONS /store/upload
// Handle CORS preflight for file upload
export const OPTIONS = async (
  req: MedusaRequest,
  res: MedusaResponse
) => {
  // Just return 204 No Content for OPTIONS
  // CORS headers are already set by Medusa's CORS middleware
  res.status(204).end()
}




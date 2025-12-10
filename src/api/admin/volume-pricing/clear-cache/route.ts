import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { clearAllPriceCaches } from "../../../../utils/price-cache";

/**
 * POST /admin/volume-pricing/clear-cache
 * Clear all pricing caches after price list updates
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    clearAllPriceCaches();

    res.json({ 
      success: true, 
      message: "Price caches cleared successfully" 
    });
  } catch (error: any) {
    console.error("Error clearing cache:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message || "Failed to clear cache" 
    });
  }
};

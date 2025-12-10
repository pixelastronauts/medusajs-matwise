import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";

/**
 * GET /store/customers/me/groups
 * Get the logged-in customer's groups
 * This is a custom endpoint since the default store API doesn't expose groups
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const customerModuleService = req.scope.resolve(Modules.CUSTOMER);

  // Get the authenticated customer ID from the request
  const customerId = req.auth_context?.actor_id;

  if (!customerId) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  try {
    // Fetch customer groups using the customer module service
    const customerGroups = await customerModuleService.listCustomerGroups({
      customers: customerId,
    });

    res.json({
      customer_id: customerId,
      groups: customerGroups.map((group: any) => ({
        id: group.id,
        name: group.name,
      })),
    });
  } catch (error: any) {
    console.error("Error fetching customer groups:", error);
    res.status(500).json({
      message: "Failed to fetch customer groups",
      error: error.message,
    });
  }
};


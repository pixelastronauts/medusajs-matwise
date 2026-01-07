import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { acceptOrderTransferWorkflow } from "@medusajs/medusa/core-flows";

/**
 * POST /admin/customers/merge
 * Merge two customer accounts with the same email
 * Transfers orders from source (usually guest) to target (usually registered)
 * Then optionally soft-deletes the source customer
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const logger = req.scope.resolve("logger");
    const query = req.scope.resolve("query");
    const orderModuleService = req.scope.resolve(Modules.ORDER);
    const customerModuleService = req.scope.resolve(Modules.CUSTOMER);

    const {
      source_customer_id,
      target_customer_id,
      delete_source = false,
    } = req.body as {
      source_customer_id: string;
      target_customer_id: string;
      delete_source?: boolean;
    };

    if (!source_customer_id || !target_customer_id) {
      return res.status(400).json({
        message: "source_customer_id and target_customer_id are required",
      });
    }

    if (source_customer_id === target_customer_id) {
      return res.status(400).json({
        message: "Cannot merge customer with itself",
      });
    }

    logger.info(`Merging customers: ${source_customer_id} -> ${target_customer_id}`);

    // Step 1: Verify both customers exist and have the same email
    const [sourceCustomer, targetCustomer] = await Promise.all([
      customerModuleService.retrieveCustomer(source_customer_id),
      customerModuleService.retrieveCustomer(target_customer_id),
    ]);

    if (!sourceCustomer || !targetCustomer) {
      return res.status(404).json({
        message: "One or both customers not found",
      });
    }

    if (sourceCustomer.email !== targetCustomer.email) {
      return res.status(400).json({
        message: "Customers must have the same email address to merge",
      });
    }

    // Step 2: Get all orders from source customer
    const { data: sourceOrders } = await query.graph({
      entity: "order",
      fields: ["id", "customer_id"],
      filters: {
        customer_id: source_customer_id,
      },
    });

    logger.info(`Found ${sourceOrders.length} orders to transfer`);

    // Step 3: Transfer orders to target customer
    // Using direct update since we're an admin and don't need approval workflow
    const orderIds = sourceOrders.map((order: any) => order.id);
    
    if (orderIds.length > 0) {
      await orderModuleService.updateOrders(
        orderIds.map((id: string) => ({
          id,
          customer_id: target_customer_id,
        }))
      );

      logger.info(`Transferred ${orderIds.length} orders to target customer`);
    }

    // Step 4: Optionally delete source customer
    if (delete_source) {
      await customerModuleService.softDeleteCustomers([source_customer_id]);
      logger.info(`Soft-deleted source customer: ${source_customer_id}`);
    }

    // Step 5: Fetch updated target customer with order count
    const { data: targetOrders } = await query.graph({
      entity: "order",
      fields: ["id"],
      filters: {
        customer_id: target_customer_id,
      },
    });

    return res.status(200).json({
      message: "Customers merged successfully",
      target_customer_id,
      orders_transferred: orderIds.length,
      source_customer_deleted: delete_source,
      target_customer_total_orders: targetOrders.length,
    });
  } catch (error: any) {
    const logger = req.scope.resolve("logger");
    logger.error("Error merging customers:", error);
    
    return res.status(500).json({
      message: error.message || "Failed to merge customers",
      type: error.type || "server_error",
    });
  }
}





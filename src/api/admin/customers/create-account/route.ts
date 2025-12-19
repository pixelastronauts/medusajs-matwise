import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { createCustomerAccountWorkflow } from "@medusajs/medusa/core-flows";

/**
 * POST /admin/customers/create-account
 * Create a customer with an account (has_account=true)
 * Handles existing auth identities by creating a new one with the provided password
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const authModuleService = req.scope.resolve(Modules.AUTH);
    const logger = req.scope.resolve("logger");

    const {
      email,
      password,
      first_name,
      last_name,
      phone,
      metadata,
    } = req.body as {
      email: string;
      password: string;
      first_name?: string;
      last_name?: string;
      phone?: string;
      metadata?: Record<string, any>;
    };

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    logger.info(`Creating customer account for ${email}`);

    // Step 1: Create or get auth identity for emailpass provider
    let authIdentity;
    
    try {
      // Try to create a new auth identity with provider identity
      authIdentity = await authModuleService.createAuthIdentities({
        provider_identities: [
          {
            provider: "emailpass",
            entity_id: email,
            provider_metadata: {
              password: password,
            },
          },
        ],
      });

      logger.info(`Created new auth identity for ${email}`);
    } catch (error: any) {
      // If identity already exists, retrieve it via provider identity
      if (error.message?.includes("already exists") || error.message?.includes("duplicate")) {
        logger.info(`Auth identity already exists for ${email}, attempting to retrieve it`);

        // Query provider identities instead of auth identities directly
        const providerIdentities = await authModuleService.listProviderIdentities({
          provider: "emailpass",
          entity_id: email,
        });

        if (providerIdentities.length === 0) {
          return res.status(400).json({
            message: "Unable to create or find auth identity. Please contact support.",
          });
        }

        // Get the auth identity from the provider identity
        authIdentity = providerIdentities[0].auth_identity;
        logger.info(`Retrieved existing auth identity: ${authIdentity.id}`);
      } else {
        throw error;
      }
    }

    // Step 2: Use the workflow to create customer account
    const { result: customer } = await createCustomerAccountWorkflow(req.scope).run({
      input: {
        authIdentityId: authIdentity.id,
        customerData: {
          email,
          first_name: first_name || null,
          last_name: last_name || null,
          phone: phone || null,
          metadata: metadata || {},
        },
      },
    });

    logger.info(`Customer account created successfully: ${customer.id}`);

    return res.status(201).json({ customer });
  } catch (error: any) {
    const logger = req.scope.resolve("logger");
    logger.error("Error creating customer account:", error);
    
    return res.status(500).json({
      message: error.message || "Failed to create customer account",
      type: error.type || "server_error",
    });
  }
}


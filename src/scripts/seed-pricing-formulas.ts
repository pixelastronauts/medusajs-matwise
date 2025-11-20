import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { PRICING_FORMULA_MODULE, type PricingFormulaService } from "../modules/pricing-formula";

/**
 * Simplified seed script for pricing formulas
 * 
 * This script will:
 * 1. Create or update the default Mat Pricing Formula
 * 2. Update formula to use sqm (square meters) instead of cm²
 * 3. Test the formula with example dimensions
 * 
 * Usage:
 *   pnpm medusa exec ./src/scripts/seed-pricing-formulas.ts
 */
export default async function seedPricingFormulas({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const pricingFormulaService = container.resolve(PRICING_FORMULA_MODULE) as PricingFormulaService;

  logger.info("🌱 Starting pricing formula seed/update process...");

  try {
    // Check if formula already exists
    const existingFormulas = await pricingFormulaService.listFormulas();
    const existing = existingFormulas.find((f: any) => f.name === "Mat Pricing Formula");

    let formula;

    if (existing) {
      logger.info("✨ Updating existing Mat Pricing Formula...");
      
      // Update to use sqm-based calculation
      formula = await pricingFormulaService.updateFormula(existing.id, {
        name: "Mat Pricing Formula",
        description: "Dynamic pricing based on square meters with shipping, markup, and profit. Calculates: ((sqm * price_per_sqm + shipping) * (1 + markup) + profit) * (1 + tax)",
        formula_string: "((width_value * length_value / 10000 * price_per_sqm + shipping_fee) * (additional_markup + 1) + base_profit) * (tax + 1)",
        parameters: {
          tax: 0.21,              // 21% VAT
          base_profit: 47,        // €47 base profit per item
          shipping_fee: 12,       // €12 shipping cost
          additional_markup: 0.9, // 90% markup
        },
        is_active: true,
      });

      logger.info(`✅ Updated formula: ${formula.id}`);
    } else {
      logger.info("🆕 Creating new Mat Pricing Formula...");
      
      // Create new formula with sqm-based calculation
      formula = await pricingFormulaService.createFormula({
        name: "Mat Pricing Formula",
        description: "Dynamic pricing based on square meters with shipping, markup, and profit. Calculates: ((sqm * price_per_sqm + shipping) * (1 + markup) + profit) * (1 + tax)",
        formula_string: "((width_value * length_value / 10000 * price_per_sqm + shipping_fee) * (additional_markup + 1) + base_profit) * (tax + 1)",
        parameters: {
          tax: 0.21,              // 21% VAT
          base_profit: 47,        // €47 base profit per item
          shipping_fee: 12,       // €12 shipping cost
          additional_markup: 0.9, // 90% markup
        },
      });

      logger.info(`✅ Created formula: ${formula.id}`);
    }

    logger.info("");
    logger.info("📝 Formula Details:");
    logger.info(`   Name: ${formula.name}`);
    logger.info(`   Status: ${formula.is_active ? "Active" : "Inactive"}`);
    logger.info(`   Formula: ${formula.formula_string}`);
    logger.info("");
    logger.info("   Parameters:");
    Object.entries(formula.parameters as Record<string, number>).forEach(([key, value]) => {
      logger.info(`   - ${key}: ${value}`);
    });
    logger.info("");

    // Test the formula with example dimensions
    logger.info("🧪 Testing formula with example dimensions:");
    logger.info("");

    // Test 1: Small mat (100cm x 100cm = 1 m²)
    logger.info("Test 1: 100cm × 100cm (1 m²) @ €120/m²");
    const testPrice1 = await pricingFormulaService.calculatePrice(
      formula.id,
      {
        width_value: 100,
        length_value: 100,
        price_per_sqm: 120,
      },
      1.0
    );
    logger.info(`   Calculated price: €${testPrice1.toFixed(2)}`);
    logger.info("");

    // Test 2: Medium mat (150cm x 100cm = 1.5 m²)
    logger.info("Test 2: 150cm × 100cm (1.5 m²) @ €120/m²");
    const testPrice2 = await pricingFormulaService.calculatePrice(
      formula.id,
      {
        width_value: 150,
        length_value: 100,
        price_per_sqm: 120,
      },
      1.0
    );
    logger.info(`   Calculated price: €${testPrice2.toFixed(2)}`);
    logger.info("");

    // Test 3: Large mat (200cm x 150cm = 3 m²)
    logger.info("Test 3: 200cm × 150cm (3 m²) @ €120/m²");
    const testPrice3 = await pricingFormulaService.calculatePrice(
      formula.id,
      {
        width_value: 200,
        length_value: 150,
        price_per_sqm: 120,
      },
      1.0
    );
    logger.info(`   Calculated price: €${testPrice3.toFixed(2)}`);
    logger.info("");

    // Test 4: Volume pricing (20+ items with 33% discount)
    logger.info("Test 4: 100cm × 100cm with volume discount @ €80/m² (33% off)");
    const testPrice4 = await pricingFormulaService.calculatePrice(
      formula.id,
      {
        width_value: 100,
        length_value: 100,
        price_per_sqm: 80, // Volume tier pricing
      },
      1.0
    );
    logger.info(`   Calculated price: €${testPrice4.toFixed(2)}`);
    logger.info(`   Savings: €${(testPrice1 - testPrice4).toFixed(2)}`);
    logger.info("");

    logger.info("📌 Next Steps:");
    logger.info("   1. Attach this formula to your product:");
    logger.info(`      POST /admin/products/{PRODUCT_ID}/pricing-formula`);
    logger.info(`      Body: { "formula_id": "${formula.id}" }`);
    logger.info("");
    logger.info("   2. Configure volume pricing tiers in variant metadata:");
    logger.info("      - 1-4 items: €120/m² (base price)");
    logger.info("      - 5-19 items: €100/m² (17% discount)");
    logger.info("      - 20+ items: €80/m² (33% discount)");
    logger.info("");
    
    logger.info("✨ Formula seeding/update complete!");
    
  } catch (error: any) {
    logger.error("❌ Error in pricing formula seed:");
    logger.error(error.message);
    if (error.stack) {
      logger.error(error.stack);
    }
    throw error;
  }
}


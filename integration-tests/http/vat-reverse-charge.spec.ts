import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { 
  createCartWorkflow,
  addToCartWorkflow,
  updateCartWorkflow,
} from "@medusajs/medusa/core-flows"
import seedTaxSetup from "../../src/scripts/seed-tax-setup"

/**
 * Integration Tests for EU VAT Reverse Charge
 * 
 * Test scenarios:
 * 1. NL domestic B2C order - 21% VAT applied
 * 2. NL domestic B2B order - 21% VAT applied (same country, no reverse charge)
 * 3. EU B2B with valid VAT - 0% VAT (reverse charge applies)
 * 4. EU B2B with invalid VAT - 21% VAT applied
 * 5. EU B2C order - 21% VAT applied
 * 6. Non-EU order - 0% VAT (export)
 */
medusaIntegrationTestRunner({
  testSuite: ({ getContainer }) => {
    describe("VAT Reverse Charge Integration Tests", () => {
      let container
      let regionId: string
      let productId: string
      let variantId: string
      let shippingOptionId: string
      let customerId: string

      beforeAll(async () => {
        container = getContainer()
        
        // Run tax setup seeder
        await seedTaxSetup({ container })
        
        // Create test product
        const productModuleService = container.resolve(Modules.PRODUCT)
        const regionModuleService = container.resolve(Modules.REGION)
        const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
        const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
        const linkModuleService = container.resolve(Modules.LINK)
        
        // Get region
        const regions = await regionModuleService.listRegions({
          name: "Europe (EU)",
        })
        regionId = regions[0].id
        
        // Get sales channel
        const salesChannels = await salesChannelModuleService.listSalesChannels({
          name: "Default Sales Channel",
        })
        const salesChannelId = salesChannels[0].id
        
        // Create product with tax-inclusive price (€121 including 21% VAT = €100 net)
        const product = await productModuleService.createProducts({
          title: "Test Product",
          status: "published",
          variants: [
            {
              title: "Test Variant",
              sku: "TEST-SKU-001",
              prices: [
                {
                  amount: 12100, // €121.00 (including 21% VAT)
                  currency_code: "eur",
                },
              ],
            },
          ],
        })
        productId = product.id
        variantId = product.variants![0].id
        
        // Link product to sales channel
        await linkModuleService.create({
          [Modules.PRODUCT]: {
            product_id: productId,
          },
          [Modules.SALES_CHANNEL]: {
            sales_channel_id: salesChannelId,
          },
        })
        
        // Create shipping option
        const shippingProfiles = await fulfillmentModuleService.listShippingProfiles()
        const shippingProfile = shippingProfiles[0]
        
        const fulfillmentSets = await fulfillmentModuleService.listFulfillmentSets()
        const serviceZone = fulfillmentSets[0]?.service_zones?.[0]
        
        if (serviceZone) {
          const shippingOption = await fulfillmentModuleService.createShippingOptions({
            name: "Standard Shipping",
            price_type: "flat",
            provider_id: "manual_manual",
            service_zone_id: serviceZone.id,
            shipping_profile_id: shippingProfile.id,
            type: {
              label: "Standard",
              description: "Standard shipping",
              code: "standard",
            },
            prices: [
              {
                currency_code: "eur",
                amount: 1000, // €10.00
              },
            ],
          })
          shippingOptionId = shippingOption.id
        }
        
        // Create test customer
        const customerModuleService = container.resolve(Modules.CUSTOMER)
        const customer = await customerModuleService.createCustomers({
          email: "test@example.com",
          first_name: "Test",
          last_name: "Customer",
        })
        customerId = customer.id
      })

      describe("Scenario 1: NL Domestic B2C Order", () => {
        it("should apply 21% VAT for NL domestic B2C order", async () => {
          // Create cart
          const { result: cart } = await createCartWorkflow(container).run({
            input: {
              currency_code: "eur",
              region_id: regionId,
              email: "test-nl-b2c@example.com",
              customer_id: customerId,
              shipping_address: {
                first_name: "Test",
                last_name: "Customer",
                address_1: "Test Street 1",
                city: "Amsterdam",
                country_code: "nl",
                postal_code: "1012AB",
              },
            },
          })

          // Add item to cart
          await addToCartWorkflow(container).run({
            input: {
              items: [
                {
                  variant_id: variantId,
                  quantity: 1,
                },
              ],
            },
          })

          // Get updated cart with tax calculations
          const cartModuleService = container.resolve(Modules.CART)
          const updatedCart = await cartModuleService.retrieveCart(cart.id, {
            relations: ["items", "items.tax_lines", "shipping_address"],
          })

          // Assertions
          expect(updatedCart.shipping_address?.country_code).toBe("nl")
          expect(updatedCart.items).toHaveLength(1)
          
          // Tax should be applied (21%)
          const item = updatedCart.items![0]
          expect(item.tax_lines).toBeDefined()
          expect(item.tax_lines!.length).toBeGreaterThan(0)
          
          const taxLine = item.tax_lines![0]
          expect(taxLine.rate).toBe(21)
          expect(taxLine.code).toBe("STANDARD")
          
          // Verify metadata
          expect(updatedCart.metadata?.reverse_charge_applies).toBeFalsy()
        })
      })

      describe("Scenario 2: NL Domestic B2B Order", () => {
        it("should apply 21% VAT for NL domestic B2B order (same country)", async () => {
          // Create cart
          const { result: cart } = await createCartWorkflow(container).run({
            input: {
              currency_code: "eur",
              region_id: regionId,
              email: "test-nl-b2b@example.com",
              customer_id: customerId,
              shipping_address: {
                first_name: "Test",
                last_name: "Company",
                address_1: "Test Street 1",
                city: "Amsterdam",
                country_code: "nl",
                postal_code: "1012AB",
              },
              metadata: {
                is_company_checkout: true,
                vat_number: "NL123456789B01", // Valid NL VAT format
              },
            },
          })

          // Update cart with company info
          await updateCartWorkflow(container).run({
            input: {
              id: cart.id,
              metadata: {
                is_company_checkout: true,
                vat_number: "NL123456789B01",
              },
            },
          })

          // Add item to cart
          await addToCartWorkflow(container).run({
            input: {
              items: [
                {
                  variant_id: variantId,
                  quantity: 1,
                },
              ],
            },
          })

          // Get updated cart
          const cartModuleService = container.resolve(Modules.CART)
          const updatedCart = await cartModuleService.retrieveCart(cart.id, {
            relations: ["items", "items.tax_lines", "shipping_address"],
          })

          // Assertions - Tax should still be applied (same country)
          expect(updatedCart.metadata?.is_company_checkout).toBe(true)
          expect(updatedCart.metadata?.vat_number).toBe("NL123456789B01")
          
          const item = updatedCart.items![0]
          const taxLine = item.tax_lines![0]
          expect(taxLine.rate).toBe(21)
          expect(taxLine.code).toBe("STANDARD")
          
          // No reverse charge for domestic orders
          expect(updatedCart.metadata?.reverse_charge_applies).toBeFalsy()
        })
      })

      describe("Scenario 3: EU B2B with Valid VAT - Reverse Charge", () => {
        it("should apply 0% VAT for EU B2B with valid VAT (reverse charge)", async () => {
          // Create cart for German company
          const { result: cart } = await createCartWorkflow(container).run({
            input: {
              currency_code: "eur",
              region_id: regionId,
              email: "test-de-b2b@example.com",
              customer_id: customerId,
              shipping_address: {
                first_name: "Test",
                last_name: "Company",
                address_1: "Test Straße 1",
                city: "Berlin",
                country_code: "de",
                postal_code: "10115",
              },
              metadata: {
                is_company_checkout: true,
                vat_number: "DE123456789", // Valid DE VAT format
              },
            },
          })

          // Update cart with company info
          await updateCartWorkflow(container).run({
            input: {
              id: cart.id,
              metadata: {
                is_company_checkout: true,
                vat_number: "DE123456789",
              },
            },
          })

          // Add item to cart
          await addToCartWorkflow(container).run({
            input: {
              items: [
                {
                  variant_id: variantId,
                  quantity: 1,
                },
              ],
            },
          })

          // Get updated cart
          const cartModuleService = container.resolve(Modules.CART)
          const updatedCart = await cartModuleService.retrieveCart(cart.id, {
            relations: ["items", "items.tax_lines", "shipping_address"],
          })

          // Assertions - Reverse charge should apply
          expect(updatedCart.metadata?.is_company_checkout).toBe(true)
          expect(updatedCart.metadata?.vat_number).toBe("DE123456789")
          expect(updatedCart.metadata?.reverse_charge_applies).toBe(true)
          
          const item = updatedCart.items![0]
          const taxLine = item.tax_lines![0]
          expect(taxLine.rate).toBe(0)
          expect(taxLine.code).toBe("REVERSE_CHARGE")
          expect(taxLine.name).toContain("Reverse Charge")
          
          // Verify reverse charge amount is calculated correctly
          expect(updatedCart.metadata?.reverse_charge_amount).toBeGreaterThan(0)
          expect(updatedCart.metadata?.reverse_charge_percentage).toBe(21)
        })
      })

      describe("Scenario 4: EU B2B with Invalid VAT", () => {
        it("should apply 21% VAT for EU B2B with invalid VAT", async () => {
          // Create cart with invalid VAT
          const { result: cart } = await createCartWorkflow(container).run({
            input: {
              currency_code: "eur",
              region_id: regionId,
              email: "test-de-invalid@example.com",
              customer_id: customerId,
              shipping_address: {
                first_name: "Test",
                last_name: "Company",
                address_1: "Test Straße 1",
                city: "Berlin",
                country_code: "de",
                postal_code: "10115",
              },
              metadata: {
                is_company_checkout: true,
                vat_number: "INVALID123", // Invalid VAT
              },
            },
          })

          // Add item to cart
          await addToCartWorkflow(container).run({
            input: {
              items: [
                {
                  variant_id: variantId,
                  quantity: 1,
                },
              ],
            },
          })

          // Get updated cart
          const cartModuleService = container.resolve(Modules.CART)
          const updatedCart = await cartModuleService.retrieveCart(cart.id, {
            relations: ["items", "items.tax_lines", "shipping_address"],
          })

          // Assertions - Tax should be applied (invalid VAT)
          const item = updatedCart.items![0]
          const taxLine = item.tax_lines![0]
          expect(taxLine.rate).toBe(21)
          expect(taxLine.code).toBe("STANDARD")
          
          // No reverse charge with invalid VAT
          expect(updatedCart.metadata?.reverse_charge_applies).toBeFalsy()
        })
      })

      describe("Scenario 5: EU B2C Order", () => {
        it("should apply 21% VAT for EU B2C order", async () => {
          // Create cart for French consumer
          const { result: cart } = await createCartWorkflow(container).run({
            input: {
              currency_code: "eur",
              region_id: regionId,
              email: "test-fr-b2c@example.com",
              customer_id: customerId,
              shipping_address: {
                first_name: "Test",
                last_name: "Consumer",
                address_1: "Test Rue 1",
                city: "Paris",
                country_code: "fr",
                postal_code: "75001",
              },
            },
          })

          // Add item to cart
          await addToCartWorkflow(container).run({
            input: {
              items: [
                {
                  variant_id: variantId,
                  quantity: 1,
                },
              ],
            },
          })

          // Get updated cart
          const cartModuleService = container.resolve(Modules.CART)
          const updatedCart = await cartModuleService.retrieveCart(cart.id, {
            relations: ["items", "items.tax_lines", "shipping_address"],
          })

          // Assertions - Tax should be applied (B2C)
          const item = updatedCart.items![0]
          const taxLine = item.tax_lines![0]
          expect(taxLine.rate).toBe(21)
          expect(taxLine.code).toBe("STANDARD")
          
          // No reverse charge for B2C
          expect(updatedCart.metadata?.reverse_charge_applies).toBeFalsy()
        })
      })

      describe("Scenario 6: Non-EU Order", () => {
        it("should apply 0% VAT for non-EU order (export)", async () => {
          // Create cart for US customer
          const { result: cart } = await createCartWorkflow(container).run({
            input: {
              currency_code: "eur",
              region_id: regionId,
              email: "test-us@example.com",
              customer_id: customerId,
              shipping_address: {
                first_name: "Test",
                last_name: "Customer",
                address_1: "Test Street 1",
                city: "New York",
                country_code: "us",
                postal_code: "10001",
              },
            },
          })

          // Add item to cart
          await addToCartWorkflow(container).run({
            input: {
              items: [
                {
                  variant_id: variantId,
                  quantity: 1,
                },
              ],
            },
          })

          // Get updated cart
          const cartModuleService = container.resolve(Modules.CART)
          const updatedCart = await cartModuleService.retrieveCart(cart.id, {
            relations: ["items", "items.tax_lines", "shipping_address"],
          })

          // Assertions - No tax for non-EU (export)
          const item = updatedCart.items![0]
          const taxLine = item.tax_lines![0]
          expect(taxLine.rate).toBe(0)
          
          // No reverse charge for non-EU
          expect(updatedCart.metadata?.reverse_charge_applies).toBeFalsy()
        })
      })

      describe("Price Calculations", () => {
        it("should calculate correct totals for NL domestic order", async () => {
          // Create cart
          const { result: cart } = await createCartWorkflow(container).run({
            input: {
              currency_code: "eur",
              region_id: regionId,
              email: "test-calc-nl@example.com",
              customer_id: customerId,
              shipping_address: {
                first_name: "Test",
                last_name: "Customer",
                address_1: "Test Street 1",
                city: "Amsterdam",
                country_code: "nl",
                postal_code: "1012AB",
              },
            },
          })

          // Add item to cart
          await addToCartWorkflow(container).run({
            input: {
              items: [
                {
                  variant_id: variantId,
                  quantity: 2, // 2 items
                },
              ],
            },
          })

          // Get updated cart
          const cartModuleService = container.resolve(Modules.CART)
          const updatedCart = await cartModuleService.retrieveCart(cart.id, {
            relations: ["items", "items.tax_lines"],
          })

          // Price calculations (2 items at €121 each = €242)
          expect(updatedCart.subtotal).toBe(24200) // €242.00
          
          // Tax should be included in prices (tax-inclusive)
          // Net amount: €242 / 1.21 = €200
          // Tax amount: €242 - €200 = €42
          expect(updatedCart.tax_total).toBe(4200) // €42.00
        })

        it("should calculate correct totals for EU B2B with reverse charge", async () => {
          // Create cart
          const { result: cart } = await createCartWorkflow(container).run({
            input: {
              currency_code: "eur",
              region_id: regionId,
              email: "test-calc-de@example.com",
              customer_id: customerId,
              shipping_address: {
                first_name: "Test",
                last_name: "Company",
                address_1: "Test Straße 1",
                city: "Berlin",
                country_code: "de",
                postal_code: "10115",
              },
              metadata: {
                is_company_checkout: true,
                vat_number: "DE123456789",
              },
            },
          })

          // Add item to cart
          await addToCartWorkflow(container).run({
            input: {
              items: [
                {
                  variant_id: variantId,
                  quantity: 2,
                },
              ],
            },
          })

          // Get updated cart
          const cartModuleService = container.resolve(Modules.CART)
          const updatedCart = await cartModuleService.retrieveCart(cart.id, {
            relations: ["items", "items.tax_lines"],
          })

          // With reverse charge, tax should be 0
          expect(updatedCart.tax_total).toBe(0)
          
          // But reverse charge amount should be stored in metadata
          expect(updatedCart.metadata?.reverse_charge_applies).toBe(true)
          expect(updatedCart.metadata?.reverse_charge_amount).toBe(4200) // €42.00 (21% of €200 net)
        })
      })
    })
  },
})

jest.setTimeout(120 * 1000) // 2 minutes timeout for integration tests


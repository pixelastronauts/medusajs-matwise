# Pricing Formula & Tiered Pricing Integration

## ✅ Integrated Features

This Medusa project includes a complete pricing formula and tiered pricing system:

### 1. **Pricing Formula Module** (`src/modules/pricing-formula/`)

- Dynamic price calculation based on product dimensions
- Safe formula evaluation engine
- Support for parameters and variables
- Volume/bulk pricing multipliers

### 2. **API Routes**

**Admin:**

- `GET /admin/pricing-formulas` - List formulas
- `POST /admin/pricing-formulas` - Create formula
- `GET /admin/pricing-formulas/:id` - Get formula
- `POST /admin/pricing-formulas/:id` - Update formula
- `DELETE /admin/pricing-formulas/:id` - Delete formula
- `POST /admin/pricing-formulas/:id/calculate` - Test calculation
- `POST /admin/products/:id/pricing-formula` - Attach formula to product

**Store:**

- `GET /store/products/:id/pricing-formula` - Get product formula
- `POST /store/products/:id/calculate-price` - Calculate price with fallback

### 3. **Admin UI** ✅ Complete

- Pricing Formulas page in Extensions menu
- Create/Edit formula pages
- Product pricing formula widget
- **Variant tiered pricing management** (Full CRUD interface)
- Volume pricing summary widget on variant details page

## 🚀 Getting Started

### 1. Run Migrations

```bash
pnpm medusa db:migrate
```

### 2. Seed Default Formula

```bash
pnpm medusa exec ./src/scripts/seed-pricing-formulas.ts
```

This script will:

- Create or update the "Mat Pricing Formula"
- Test with example dimensions
- Show usage instructions

### 3. Configure Products

Attach formula to a product:

```bash
POST /admin/products/{PRODUCT_ID}/pricing-formula
{
  "formula_id": "formula_..."
}
```

### 4. Configure Variant Pricing Tiers

**Via Admin UI (Recommended):**

1. Navigate to Products → [Your Product] → Variants → [Variant]
2. Scroll to "Volume Pricing" widget
3. Click "Set Up Pricing" or "Edit Tiers"
4. Add/edit tiers with min/max quantity and price per m²
5. Save changes

**Via API:**
Add to variant metadata:

```json
{
	"volume_pricing_tiers": [
		{ "minQty": 1, "maxQty": 4, "pricePerSqm": 120 },
		{ "minQty": 5, "maxQty": 19, "pricePerSqm": 100 },
		{ "minQty": 20, "maxQty": null, "pricePerSqm": 80 }
	]
}
```

## 📐 How It Works

### Formula Structure

The default formula uses square meters (m²):

```
((width * height / 10000 * price_per_sqm + shipping) * (1 + markup) + profit) * (1 + tax)
```

**Variables:**

- `width_value` - Width in cm
- `height_value` - Height in cm
- `price_per_sqm` - Price per square meter (from tier)

**Parameters:**

- `tax` - VAT (21%)
- `base_profit` - Base profit per item (€47)
- `shipping_fee` - Shipping cost (€12)
- `additional_markup` - Additional markup (90%)

### Price Calculation Flow

1. Get product → check for `pricing_formula_id` in metadata
2. Get variant → check for `volume_pricing_tiers` in metadata
3. Find appropriate tier based on quantity
4. Calculate using formula: `width × height / 10000 × price_per_sqm`
5. Apply formula parameters (shipping, markup, profit, tax)
6. Round down to whole euros

### Fallback Pricing

If no formula is attached or calculation fails:

```
sqm = (width_cm × height_cm) ÷ 10,000
price = sqm × pricePerSqm + customization_fees
```

## 🧪 Testing

### Test via Script

```bash
pnpm medusa exec ./src/scripts/seed-pricing-formulas.ts
```

### Test via API

```bash
POST /store/products/{PRODUCT_ID}/calculate-price
{
  "width_cm": 100,
  "height_cm": 150,
  "quantity": 10,
  "variant_id": "variant_...",
  "customization_fees": 0
}
```

Response:

```json
{
	"price_per_item": 185,
	"total_price": 1850,
	"quantity": 10,
	"price_per_sqm": 100,
	"dimensions": {
		"width_cm": 100,
		"height_cm": 150,
		"sqm": 1.5
	}
}
```

## 📊 Example Pricing

For a 100cm × 100cm (1 m²) mat:

| Quantity | Tier | Price/m² | Per Item | Total             |
| -------- | ---- | -------- | -------- | ----------------- |
| 1-4      | 1    | €120     | ~€320    | €320              |
| 5-19     | 2    | €100     | ~€270    | €1,350 (5 items)  |
| 20+      | 3    | €80      | ~€220    | €4,400 (20 items) |

_Prices include: sqm cost + shipping (€12) + markup (90%) + profit (€47) + VAT (21%)_

## 🔧 Customization

### Modify Formula

Edit parameters in seed script or via admin:

```javascript
{
  tax: 0.21,              // Change VAT rate
  base_profit: 50,        // Adjust profit
  shipping_fee: 15,       // Update shipping
  additional_markup: 1.0  // Change markup (100%)
}
```

### Add New Formula

Create via API or admin UI with custom formula string.

### Configure Tiers

Add more tiers for granular volume pricing:

```json
{
	"volume_pricing_tiers": [
		{ "minQty": 1, "maxQty": 2, "pricePerSqm": 150 },
		{ "minQty": 3, "maxQty": 9, "pricePerSqm": 120 },
		{ "minQty": 10, "maxQty": 24, "pricePerSqm": 100 },
		{ "minQty": 25, "maxQty": 49, "pricePerSqm": 85 },
		{ "minQty": 50, "maxQty": null, "pricePerSqm": 70 }
	]
}
```

## 🎨 Admin UI Navigation

### Access Tiered Pricing for Variants

1. Go to **Products** in admin panel
2. Select a product
3. Click on **Variants** tab
4. Select a variant
5. Scroll down to **Volume Pricing** widget
6. Click **"Set Up Pricing"** or **"Edit Tiers"**
7. Manage pricing tiers:
   - Set min/max quantity ranges
   - Configure price per m² for each tier
   - See discount percentages automatically calculated
   - Preview how customers will see pricing
8. Click **"Save Prices"**
9. Click **"Back to Variant"** to return to variant details

### Access Pricing Formulas

1. Go to **Extensions** → **Pricing Formulas**
2. View all formulas or create new ones
3. Attach formulas to products via product detail page

## 📚 Next Steps

1. ✅ ~~Complete admin UI widgets~~ (Done!)
2. Test with your products
3. Adjust formula parameters
4. Configure variant tiers via UI
5. Deploy to production

## 🔗 Related

- Medusa Documentation: https://docs.medusajs.com
- Formula Evaluation: Safe math operations only
- Tiered Pricing: Stored in variant metadata

# Variant → Design Bidirectional Linking Flow

## Overview

When a customer customizes a logomat in the frontend, this automated flow ensures that:
1. A custom variant is created in Medusa with all customization metadata
2. The Dashboard receives the variant and creates a Design record
3. The Medusa variant is updated with the `design_id` for bidirectional linking

## Architecture

```
┌─────────────┐
│  FRONTEND   │ 1. User customizes logomat
│   (Nuxt)    │ 2. Clicks "Add to Cart"
└──────┬──────┘
       │
       │ POST /store/products/:id/variants
       │ { metadata: { width_cm, logo, color, ... } }
       ▼
┌─────────────┐
│  MEDUSAJS   │ 3. Creates custom variant
└──────┬──────┘
       │
       │ 4. Emits event: "product-variant.created"
       │    (src/subscribers/variant-created.ts)
       │
       │ 5. Webhook → POST /api/webhooks/medusa/variants
       │    { id, metadata, product_id, ... }
       ▼
┌─────────────┐
│  DASHBOARD  │ 6. Syncs variant to DB
│  (Laravel)  │ 7. Creates Design from variant
└──────┬──────┘    (Design::createFromVariant)
       │
       │ 8. Updates Medusa variant
       │    PATCH /admin/variants/:id
       │    { metadata: { design_id: 123 } }
       ▼
┌─────────────┐
│  MEDUSAJS   │ 9. Variant now has design_id ✅
└─────────────┘
```

## Components

### 1. Frontend (Nuxt)
**File:** `web/frontend/matwise-nuxt/app/components/product/customizer/logomat.vue`

```typescript
const createCustomVariantForOrder = async () => {
  const variant = await createCustomVariant(props.productId, {
    title,
    sku,
    options: { Material: uniqueOptionValue },
    prices: priceTiers,
    metadata: {
      width_cm: customWidth.value,
      height_cm: customHeight.value,
      logo: uploadedLogo.value,
      color: selectedColor.value,
      // ... other customization data
      is_custom_order: true, // ← Triggers webhook processing
    },
  });
  
  return variant;
};
```

### 2. MedusaJS - Variant Creation
**File:** `src/api/store/products/[id]/variants/route.ts`

```typescript
// POST /store/products/:id/variants
// Creates a custom variant with metadata
export const POST = async (req, res) => {
  const { metadata, prices, ... } = req.body;
  
  const { result } = await createProductVariantsWorkflow(req.scope).run({
    input: {
      product_variants: [{
        product_id: productId,
        metadata: {
          ...metadata,
          custom: true,
          created_via_api: true,
        },
        prices: formattedPrices,
      }],
    },
  });
  
  // This emits "product-variant.created" event
  res.json({ variant: result[0] });
};
```

### 3. MedusaJS - Webhook Subscriber
**File:** `src/subscribers/variant-created.ts` ⭐ NEW

```typescript
export default async function variantCreatedHandler({ event, container }) {
  const { id } = event.data;
  const variant = await fetchVariant(id);
  
  // Only process custom variants
  if (!variant.metadata?.is_custom_order) return;
  
  // Send webhook to Dashboard
  await axios.post(
    `${DASHBOARD_URL}/api/webhooks/medusa/variants`,
    variant,
    {
      headers: {
        'X-Medusa-Event': 'product-variant.created',
        'X-Webhook-Secret': process.env.DASHBOARD_WEBHOOK_SECRET,
      },
    }
  );
}

export const config = {
  event: 'product-variant.created',
};
```

### 4. Dashboard - Webhook Handler
**File:** `app/Http/Controllers/Api/MedusaWebhookController.php` ⭐ NEW METHOD

```php
public function handleVariant(Request $request)
{
    $variantData = $request->all();
    $productId = $variantData['product_id'];
    
    // Check if custom variant
    if (!($variantData['metadata']['is_custom_order'] ?? false)) {
        return response()->json(['message' => 'Non-custom variant skipped']);
    }
    
    // 1. Sync variant to local DB
    $variantService = app(\App\Services\VariantService::class);
    $variant = $variantService->syncVariant($variantData, $productId);
    
    // 2. Get the auto-created Design
    $design = Design::where('medusa_variant_id', $variant->medusa_variant_id)->first();
    
    if ($design) {
        // 3. Update Medusa variant with design_id
        $medusaVariantService = app(\App\Services\MedusaVariantService::class);
        $medusaVariantService->updateVariantMetadata(
            $variant->medusa_variant_id,
            ['design_id' => $design->id]
        );
        
        // 4. Update local variant metadata
        $variant->update([
            'metadata' => array_merge($variant->metadata ?? [], [
                'design_id' => $design->id,
            ]),
        ]);
    }
    
    return response()->json([
        'success' => true,
        'variant_id' => $variant->medusa_variant_id,
        'design_id' => $design?->id,
    ]);
}
```

**Route:** `routes/api.php`
```php
Route::post('/webhooks/medusa/variants', [MedusaWebhookController::class, 'handleVariant']);
```

### 5. Dashboard - Variant Sync Service
**File:** `app/Services/VariantService.php`

```php
protected function syncDesignFromVariant(Variant $variant): ?Design
{
    // Check if design exists
    $design = Design::where('medusa_variant_id', $variant->medusa_variant_id)->first();
    
    if ($design) {
        // Update existing design
        $design->update([...]);
    } else {
        // Create new design from variant metadata
        $design = Design::createFromVariant($variant);
    }
    
    return $design;
}
```

### 6. MedusaJS - Variant Metadata Update
**File:** `src/api/admin/variants/[id]/route.ts` ⭐ NEW

```typescript
// PATCH /admin/variants/:id
export const PATCH = async (req, res) => {
  const variantId = req.params.id;
  const { metadata } = req.body;
  
  // Merge with existing metadata
  const existingVariant = await fetchVariant(variantId);
  const updatedMetadata = {
    ...existingVariant.metadata,
    ...metadata,
  };
  
  await productModuleService.updateProductVariants(variantId, {
    metadata: updatedMetadata,
  });
  
  res.json({ variant: updatedVariant });
};
```

### 7. Dashboard - Medusa API Service
**File:** `app/Services/MedusaVariantService.php` ⭐ NEW METHOD

```php
public function updateVariantMetadata(string $variantId, array $metadata): ?Response
{
    $response = $this->patch("/admin/variants/{$variantId}", [
        'metadata' => $metadata,
    ]);
    
    return $response->successful() ? $response : null;
}
```

## Configuration

### Environment Variables

**MedusaJS** (`.env`):
```bash
DASHBOARD_URL=https://dashboard.matwise.app
DASHBOARD_WEBHOOK_SECRET=your-webhook-secret-here
```

**Dashboard** (`.env`):
```bash
MEDUSA_URL=https://api.matwise.app
MEDUSA_API_KEY=your-api-key-here
```

## Data Flow Example

### Step 1: Frontend Creates Variant
```json
POST /store/products/prod_123/variants
{
  "title": "Logomat - 100x80cm - Budget",
  "sku": "MW_DOORMAT-CUSTOM-100X80-1234567890",
  "metadata": {
    "width_cm": 100,
    "height_cm": 80,
    "material": "budget",
    "border": true,
    "print_type": "simpel",
    "logo": {
      "id": "logo-uuid-123",
      "url": "https://s3.../logo.png"
    },
    "logo_size_cm": 25,
    "color": "#e8d4b8",
    "is_custom_order": true
  }
}
```

### Step 2: MedusaJS Emits Event
```typescript
{
  event: "product-variant.created",
  data: { id: "variant_abc123" }
}
```

### Step 3: Dashboard Receives Webhook
```json
POST /api/webhooks/medusa/variants
Headers: {
  "X-Medusa-Event": "product-variant.created",
  "X-Webhook-Secret": "..."
}
Body: {
  "id": "variant_abc123",
  "metadata": { ... },
  "product_id": "prod_123"
}
```

### Step 4: Design Created
```php
Design {
  id: 456,
  medusa_variant_id: "variant_abc123",
  medusa_product_id: "prod_123",
  width_cm: 100,
  height_cm: 80,
  logo_data: {...},
  // ... other fields
}
```

### Step 5: Variant Updated
```json
PATCH /admin/variants/variant_abc123
{
  "metadata": {
    "design_id": 456  // ← Bidirectional link complete!
  }
}
```

## Result

The variant now has complete bidirectional linking:

**Medusa Variant:**
```json
{
  "id": "variant_abc123",
  "metadata": {
    "width_cm": 100,
    "height_cm": 80,
    "logo": {...},
    "design_id": 456  // ← Link to Dashboard Design
  }
}
```

**Dashboard Design:**
```json
{
  "id": 456,
  "medusa_variant_id": "variant_abc123",  // ← Link to Medusa Variant
  "medusa_product_id": "prod_123",
  "width_cm": 100,
  "height_cm": 80
}
```

## Testing

### Manual Test Flow

1. **Create a logomat variant in frontend:**
   ```bash
   # Navigate to http://localhost:3000/products/logomat
   # Customize dimensions, logo, color
   # Click "Add to Cart"
   ```

2. **Verify webhook was sent:**
   ```bash
   # Check MedusaJS logs
   tail -f logs/medusa.log | grep "variant-created"
   ```

3. **Verify webhook was received:**
   ```bash
   # Check Dashboard logs
   tail -f storage/logs/laravel.log | grep "Variant webhook"
   ```

4. **Verify design was created:**
   ```bash
   # Query Dashboard database
   php artisan tinker
   >>> Design::latest()->first();
   ```

5. **Verify variant has design_id:**
   ```bash
   # Query Medusa API
   curl http://localhost:9999/admin/variants/variant_abc123 \
     -H "Authorization: Basic YOUR_API_KEY"
   ```

### Debugging

Check webhook logs in Dashboard:
```sql
SELECT * FROM medusa_webhook_logs 
WHERE event_type = 'product-variant.created' 
ORDER BY created_at DESC 
LIMIT 10;
```

## Benefits

✅ **Automatic**: No manual sync required
✅ **Bidirectional**: Both systems reference each other
✅ **Real-time**: Design created immediately when variant is created
✅ **Reliable**: Logged and trackable via webhook logs
✅ **Scalable**: Async processing prevents blocking

## Troubleshooting

### Issue: Webhook not received
- Check `DASHBOARD_URL` in MedusaJS `.env`
- Check Dashboard logs: `storage/logs/laravel.log`
- Check webhook logs table: `medusa_webhook_logs`

### Issue: Design not created
- Check if variant has `is_custom_order: true` in metadata
- Check `VariantService::syncVariant()` logs
- Check `Design::createFromVariant()` method

### Issue: Variant not updated with design_id
- Check Dashboard can reach Medusa API
- Check `MEDUSA_URL` and `MEDUSA_API_KEY` in Dashboard `.env`
- Check MedusaJS endpoint: `PATCH /admin/variants/:id`

## Migration from Old Flow

**Before:** Manual sync required
```bash
php artisan medusa:sync-variants --custom-only
```

**After:** Automatic on variant creation
- No manual commands needed
- Real-time design creation
- Bidirectional linking

Existing variants without `design_id` can still be synced manually using the command above.




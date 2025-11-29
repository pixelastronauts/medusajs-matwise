# Dashboard Two-Way Sync Setup

This guide explains how to set up two-way synchronization between Medusa and the Filament Dashboard.

## Overview

The system provides bidirectional sync:
- **Medusa → Dashboard**: Webhooks send updates when customers/orders change in Medusa
- **Dashboard → Medusa**: API calls update Medusa when changes are made in the dashboard

## Loop Prevention

Both directions implement loop prevention to avoid endless update cycles:

### Medusa Side (Webhooks)
- Checks `metadata._last_synced_from` field
- Skips sending webhook if entity was synced from dashboard within last 30 seconds
- Located in: `src/subscribers/dashboard-sync.ts`

### Dashboard Side (Jobs)
- Checks `metadata._last_synced_from` field  
- Skips sending to Medusa if entity was synced from Medusa within last 30 seconds
- Located in: `dashboard/app/Jobs/SyncCustomerToMedusa.php`

## Configuration

### 1. Set Environment Variables in Medusa

Add to your `.env` file:

```bash
# Dashboard API endpoint
DASHBOARD_API_URL=https://your-dashboard.com/api

# Optional webhook secret for security
DASHBOARD_WEBHOOK_SECRET=your_secret_key_here
```

### 2. Configure Routes in Dashboard

Make sure these routes are accessible in your Laravel dashboard:

```
POST /api/webhooks/medusa/customers
POST /api/webhooks/medusa/orders
POST /api/webhooks/medusa/products (optional)
```

These are already configured in `routes/api.php`.

### 3. Queue Configuration

Both systems use queues for async processing:

**Medusa**: Events are processed via Medusa's built-in event system
**Dashboard**: Laravel queue workers must be running

```bash
# In dashboard directory
php artisan queue:work --queue=webhooks,medusa-sync
```

## Events Synced

### From Medusa to Dashboard

| Event | Trigger | Data Synced |
|-------|---------|-------------|
| `customer.created` | New customer created | Email, name, phone, metadata |
| `customer.updated` | Customer details changed | All customer fields + metadata |
| `order.placed` | Order is placed | Order details, line items, addresses, customer |
| `order.updated` | Order status/details change | All order fields, addresses |

### From Dashboard to Medusa

| Action | Trigger | Data Synced |
|--------|---------|-------------|
| Customer Edit | Save customer form | Email, name, phone, company, VAT info |
| Order Edit | Save order form | Shipping/billing addresses, metadata |

## Webhook Payload Structure

### Customer Webhook

```json
{
  "id": "cus_01...",
  "email": "customer@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+31612345678",
  "has_account": true,
  "metadata": {
    "is_company": true,
    "vat_number": "NL123456789B01",
    "company": "Example BV",
    "_last_synced_from": "medusa",
    "_last_synced_at": "2025-11-28T15:00:00.000Z"
  }
}
```

### Order Webhook

```json
{
  "id": "order_01...",
  "display_id": 1234,
  "status": "pending",
  "payment_status": "captured",
  "fulfillment_status": "not_fulfilled",
  "customer_id": "cus_01...",
  "shipping_address": { ... },
  "billing_address": { ... },
  "items": [ ... ],
  "total": 99.99,
  "metadata": {
    "_last_synced_from": "medusa",
    "_last_synced_at": "2025-11-28T15:00:00.000Z"
  }
}
```

## Testing

### 1. Test Medusa → Dashboard Sync

```bash
# In Medusa, update a customer via admin panel or API
# Check dashboard logs to see webhook received:
tail -f dashboard/storage/logs/laravel.log | grep "Processing customer webhook"
```

### 2. Test Dashboard → Medusa Sync

```bash
# In Dashboard, edit a customer and save
# Check Medusa logs:
npm run dev  # or check Railway logs
# Look for "Customer updated" messages
```

### 3. Verify Loop Prevention

```bash
# Update customer in Dashboard
# Check that only ONE webhook is sent to Medusa
# Check that webhook from Medusa is NOT sent back to Dashboard
# You should see "Skipping sync to prevent loop" messages in logs
```

## Monitoring

### Dashboard Logs

```bash
tail -f dashboard/storage/logs/laravel.log
```

Look for:
- `Processing customer webhook`
- `Processing order webhook`
- `Skipping sync to prevent loop`
- `Customer synced to Medusa`

### Medusa Logs

```bash
npm run dev  # Development
# or
railway logs  # Production
```

Look for:
- `✓ Synced customer.updated to dashboard`
- `✗ Error sending webhook to`
- `Skipping customer sync to prevent loop`

### Queue Status

```bash
# Dashboard queue workers
php artisan queue:monitor webhooks medusa-sync

# View failed jobs
php artisan queue:failed

# Retry failed jobs
php artisan queue:retry all
```

## Troubleshooting

### Webhooks not being sent from Medusa

1. Check `DASHBOARD_API_URL` is set correctly
2. Verify dashboard is accessible from Medusa server
3. Check Medusa logs for error messages
4. Test connection: `curl -X POST $DASHBOARD_API_URL/webhooks/medusa/customers`

### Dashboard not syncing to Medusa

1. Check queue workers are running: `ps aux | grep queue:work`
2. Check Medusa API URL in dashboard `.env`: `MEDUSA_URL`
3. Check Medusa API key: `MEDUSA_API_KEY`
4. Review failed jobs: `php artisan queue:failed`

### Endless Loop Detected

The system should prevent this automatically, but if you see loops:

1. Check that metadata tracking is working (`_last_synced_from`, `_last_synced_at`)
2. Verify both sides are checking these fields
3. Increase the time window (currently 30 seconds) if needed

### Data Not Syncing

1. Check webhook logs in dashboard
2. Verify events are subscribed in `dashboard-sync.ts` config
3. Check network connectivity between services
4. Verify no firewall/CORS blocking requests

## Security Considerations

1. **Use HTTPS** in production for `DASHBOARD_API_URL`
2. **Set DASHBOARD_WEBHOOK_SECRET** and implement signature verification
3. **Restrict API access** using Laravel middleware/guards
4. **Monitor webhook endpoints** for unusual activity
5. **Rate limit** webhook endpoints to prevent abuse

## Advanced: Adding More Sync Events

To sync additional events:

### 1. Add to Medusa Subscriber

Edit `src/subscribers/dashboard-sync.ts`:

```typescript
case 'product.variant.updated':
  // Fetch variant data
  payload = await productModuleService.retrieveVariant(data.id)
  endpoint = '/webhooks/medusa/variants'
  break
```

### 2. Add to Subscriber Config

```typescript
export const config: SubscriberConfig = {
  event: [
    // ... existing events
    'product.variant.updated',
  ]
}
```

### 3. Create Dashboard Webhook Handler

In `dashboard/app/Http/Controllers/Api/MedusaWebhookController.php`:

```php
public function handleVariant(Request $request) {
    // Process variant webhook
}
```

### 4. Add Route

In `routes/api.php`:

```php
Route::post('/webhooks/medusa/variants', [MedusaWebhookController::class, 'handleVariant']);
```

## Performance Optimization

- Webhooks are async - they don't block Medusa operations
- Dashboard processes webhooks in queue - doesn't block HTTP responses
- Failed jobs are retried automatically (3 times with backoff)
- Sync tracking prevents unnecessary updates

## Support

For issues or questions:
1. Check logs on both sides
2. Review webhook payloads in `medusa_webhook_logs` table
3. Check queue failed jobs: `php artisan queue:failed`
4. Review this documentation



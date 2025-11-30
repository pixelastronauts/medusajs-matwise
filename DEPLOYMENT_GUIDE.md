# Medusa Deployment Guide (Railway)

## The Migration Error Issue

The error you're seeing:
```
relation "public.invoice_config" does not exist
```

This happens because database migrations haven't been run before the server starts.

## Solution

I've updated the `start` script to automatically run migrations before starting the server:

```json
"start": "init-backend && cd .medusa/server && medusa db:migrate && medusa start --verbose"
```

This ensures that:
1. `init-backend` sets up the environment
2. `medusa db:migrate` creates all necessary database tables
3. `medusa start` starts the server

## Railway Configuration

The `railway.json` file is configured to:
- Use RAILPACK builder (faster builds)
- Run migrations automatically on startup
- Restart on failure with up to 10 retries

## Manual Migration (if needed)

If you ever need to run migrations manually in Railway:

1. Open Railway dashboard
2. Go to your Medusa service
3. Click on "Settings" → "Deploy"
4. Add a one-time command:
   ```bash
   cd .medusa/server && medusa db:migrate
   ```

Or via Railway CLI:
```bash
railway run bun run migrate
```

## Environment Variables Required

Make sure these are set in Railway:

### Database
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string (optional but recommended)

### Secrets
- `JWT_SECRET` - Random string for JWT tokens
- `COOKIE_SECRET` - Random string for cookies

### Dashboard Sync (Two-Way Sync)
- `DASHBOARD_API_URL` - Your dashboard API URL (e.g., `https://dashboard.matwise.com/api`)
- `DASHBOARD_WEBHOOK_SECRET` - Optional webhook secret

### Other
- `ADMIN_CORS` - Admin panel CORS origins
- `AUTH_CORS` - Auth CORS origins  
- `STORE_CORS` - Store/frontend CORS origins
- `BACKEND_URL` - Your Medusa backend URL

## Verifying Deployment

After deployment, check the logs for:

```
✓ Migrations completed successfully
✓ Backend initialized successfully
✓ Connection to Redis in module 'event-bus-redis' established
✓ Connection to Redis in module 'workflow-engine-redis' established
```

If you see the InvoiceGenerator error again:

1. Check that migrations ran: Look for "Running database migrations..." in logs
2. Check database connection: Verify `DATABASE_URL` is correct
3. Check table exists: Connect to your Railway Postgres and run:
   ```sql
   SELECT * FROM public.invoice_config;
   ```

## Local Development

For local development, migrations run automatically when you use:

```bash
bun run dev
```

Or manually:
```bash
bun run migrate
```

## Troubleshooting

### Error: "relation does not exist"
- **Cause**: Migrations haven't run
- **Fix**: Redeploy or run `railway run bun run migrate`

### Error: "Connection refused"
- **Cause**: Database/Redis not accessible
- **Fix**: Check environment variables and Railway service links

### Error: "Module not found"
- **Cause**: Dependencies not installed
- **Fix**: Check that `bun install` ran during build

### Startup takes too long / times out
- **Cause**: Large migration or slow database
- **Fix**: Increase Railway timeout or split into separate migration job

## Best Practices

1. **Always run migrations before deployment** - The start script now does this automatically
2. **Use Railway database backups** - Enable automatic backups in Railway
3. **Monitor logs after deployment** - Check for any migration errors
4. **Test locally first** - Run `bun run build && bun run start` locally before pushing

## Migration Files Location

All migration files are in:
```
src/modules/*/migrations/
```

The InvoiceGenerator module has migrations in:
```
src/modules/invoice-generator/migrations/
  - Migration20251120131524.ts
  - Migration20251127000000.ts
  - Migration20251127120000.ts
```

These create the `invoice` and `invoice_config` tables needed by the system.


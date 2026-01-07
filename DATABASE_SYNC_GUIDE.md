# Database Sync Guide

Easily sync your production database to your local development environment with a click of a button!

## Features

✅ **One-Click Sync** - Simple UI in the admin panel  
✅ **Selective Sync** - Choose specific tables or sync everything  
✅ **Automatic Anonymization** - Safely anonymizes customer emails and sensitive data  
✅ **Progress Tracking** - See sync status in real-time  
✅ **Safety First** - Only works in development environments  

## Setup

### 1. Add Environment Variable

Add your production database URL to your `.env` file:

```env
# Your local development database
DATABASE_URL=postgresql://user:password@localhost:5432/medusa_dev

# Your production database (for syncing)
PROD_DATABASE_URL=postgresql://user:password@prod-host:5432/medusa_prod
```

### 2. Install pg_dump and psql (if not already installed)

#### macOS
```bash
brew install postgresql
```

#### Ubuntu/Debian
```bash
sudo apt-get install postgresql-client
```

#### Windows
Download from [PostgreSQL Downloads](https://www.postgresql.org/download/windows/)

### 3. Restart Your Dev Server

```bash
bun run dev
```

## Usage

### Accessing the Sync Page

1. Open your Medusa admin panel (default: `http://localhost:9000/app`)
2. Navigate to **Settings** → **Database Sync**
3. You'll see a list of all tables from your production database

### Syncing Options

**Option 1: Sync All Tables**
- Click "Sync All Tables" to sync everything at once
- Perfect for initial setup or complete refresh

**Option 2: Sync Selected Tables**
- Check the boxes next to specific tables you want to sync
- Click "Sync Selected"
- Great for targeted updates (e.g., only sync products)

### What Gets Synced?

✅ **Database records** - All table data  
✅ **Relationships** - Foreign keys and constraints  
✅ **Sequences** - Auto-increment values  

❌ **File uploads** - Images, PDFs, etc. (use MinIO sync separately)  
❌ **Redis data** - Temporary cache/sessions  

## Automatic Data Anonymization

For safety, the following data is automatically anonymized after sync:

- **Customer emails**: Changed to `dev+{customer_id}@example.com`
- **Phone numbers**: Cleared
- **Payment sessions**: Cleared (sensitive payment data)

This ensures you can safely develop without accidentally sending emails or accessing production payment info.

## Safety Features

### Development-Only
The sync feature **only works** when `NODE_ENV !== "production"`. This prevents accidentally syncing the wrong direction!

### Confirmation Required
The UI shows clear warnings about what will happen before syncing.

### Non-Destructive to Production
The sync only reads from production and writes to dev - it never modifies production data.

## Common Workflows

### Initial Setup
```
1. Sync all tables
2. Test your local environment
3. Develop features
```

### Daily Development
```
1. Sync specific tables (e.g., products, collections)
2. Get fresh data from production
3. Test with real-world data
```

### Before Major Features
```
1. Sync everything
2. Ensure your dev matches production structure
3. Develop and test thoroughly
```

## Troubleshooting

### "PROD_DATABASE_URL not configured"
- Make sure you've added `PROD_DATABASE_URL` to your `.env` file
- Restart your dev server

### "pg_dump: command not found"
- Install PostgreSQL client tools (see setup section)
- Make sure `pg_dump` and `psql` are in your PATH

### "Connection refused"
**Production Database:**
- Check that your production database allows connections from your IP
- Verify firewall rules
- For Railway/Heroku: Get the public connection URL

**Development Database:**
- Make sure your local PostgreSQL is running
- Check `DATABASE_URL` is correct

### Sync is Slow
- Large databases take time! Be patient
- Consider syncing only the tables you need
- Production network speed affects sync time

### Tables Not Showing Up
- Check that production database has public schema tables
- Verify `PROD_DATABASE_URL` points to correct database
- Check database user has SELECT permissions

## MinIO File Sync (Optional)

Database sync doesn't copy uploaded files. To sync MinIO files:

```bash
# Install MinIO client
brew install minio/stable/mc

# Configure production and dev aliases
mc alias set prod https://minio.prod.example.com ACCESS_KEY SECRET_KEY
mc alias set dev http://localhost:9000 minioadmin minioadmin

# Sync files
mc mirror prod/medusa-media dev/medusa-media
```

## Advanced Usage

### Manual Sync via Terminal

If you prefer command-line:

```bash
# Dump production
pg_dump $PROD_DATABASE_URL --no-owner --no-acl --clean -f prod_dump.sql

# Restore to dev
psql $DATABASE_URL -f prod_dump.sql

# Anonymize (optional)
psql $DATABASE_URL << EOF
UPDATE customer SET email = 'dev+' || id || '@example.com', phone = NULL;
TRUNCATE payment_session CASCADE;
EOF
```

### Sync Specific Tables Only

```bash
# Sync only products and variants
pg_dump $PROD_DATABASE_URL \
  -t public.product \
  -t public.product_variant \
  -t public.product_images \
  --no-owner --no-acl --clean \
  -f partial_dump.sql

psql $DATABASE_URL -f partial_dump.sql
```

## Best Practices

1. **Sync Regularly** - Keep your dev environment up-to-date
2. **Select What You Need** - Don't sync everything if you only need specific tables
3. **Backup First** - If you have important local dev data, back it up
4. **Check Disk Space** - Large databases need temporary disk space
5. **Test After Sync** - Run a quick smoke test to ensure everything works

## Security Notes

- Never commit `PROD_DATABASE_URL` to version control
- Use `.env` files (which should be in `.gitignore`)
- The sync tool only works in development mode
- Customer data is automatically anonymized
- Payment credentials are cleared

## Need Help?

If you run into issues:
1. Check the browser console for errors
2. Check your terminal logs where Medusa is running
3. Verify environment variables are set correctly
4. Ensure database connectivity from your machine

Happy syncing! 🚀




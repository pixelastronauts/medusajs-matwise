#!/bin/bash
set -e

echo "Running database migrations..."

# Run migrations using Medusa CLI
cd .medusa/server
npx medusa migrations run

echo "Migrations completed successfully"


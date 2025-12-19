#!/bin/bash
set -e

echo "Running database migrations..."

# Run migrations using Medusa CLI
cd .medusa/server
bunx medusa db:migrate

echo "Migrations completed successfully"


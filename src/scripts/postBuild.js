const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const MEDUSA_SERVER_PATH = path.join(process.cwd(), '.medusa', 'server');

// Check if .medusa/server exists - if not, build process failed
if (!fs.existsSync(MEDUSA_SERVER_PATH)) {
  throw new Error('.medusa/server directory not found. This indicates the Medusa build process failed. Please check for build errors.');
}

// Copy bun.lock
fs.copyFileSync(
  path.join(process.cwd(), 'bun.lock'),
  path.join(MEDUSA_SERVER_PATH, 'bun.lock')
);

// Copy .env if it exists
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  fs.copyFileSync(
    envPath,
    path.join(MEDUSA_SERVER_PATH, '.env')
  );
}

// Install dependencies
console.log('Installing dependencies in .medusa/server...');
execSync('bun install --production --frozen-lockfile', {
  cwd: MEDUSA_SERVER_PATH,
  stdio: 'inherit'
});

// Note: Migrations will be run by the start script before starting the server
console.log('Build completed. Run migrations before starting the server with: bun run migrate');

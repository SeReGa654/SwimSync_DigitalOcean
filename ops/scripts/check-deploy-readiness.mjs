import fs from 'node:fs';
import path from 'node:path';

const requiredFiles = [
  'docker-compose.production.yml',
  '.env.production.example',
  'ops/nginx/swimsync.conf',
  'backend/Dockerfile',
  'frontend/Dockerfile',
  'docx-service/Dockerfile',
  'ops/scripts/prod-first-deploy.sh',
  'ops/scripts/prod-update.sh',
  'ops/scripts/prod-rollback.sh',
  'ops/scripts/prod-backup.sh',
  'ops/scripts/prod-restore.sh',
  'ops/scripts/prod-restart.sh',
  'ops/scripts/prod-healthcheck.sh',
  'ops/scripts/prod-certbot-renew.sh',
];

const missingFiles = requiredFiles.filter((file) => !fs.existsSync(path.resolve(file)));
if (missingFiles.length) {
  console.error('[deploy-readiness] missing files:');
  for (const file of missingFiles) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

const envExample = fs.readFileSync(path.resolve('.env.production.example'), 'utf8');
const requiredEnvKeys = [
  'DATABASE_URL=',
  'POSTGRES_PASSWORD=',
  'AUTH_BOOTSTRAP_ADMIN_PASSWORD=',
  'FRONTEND_URL=',
  'NEXT_PUBLIC_WS_URL=',
  'APP_DOMAIN=',
  'LETSENCRYPT_EMAIL=',
  'ADMIN_COOKIE_SECURE=true',
];
const missingEnv = requiredEnvKeys.filter((key) => !envExample.includes(key));
if (missingEnv.length) {
  console.error('[deploy-readiness] .env.production.example is missing keys:');
  for (const key of missingEnv) {
    console.error(`- ${key}`);
  }
  process.exit(1);
}

const prodCompose = fs.readFileSync(path.resolve('docker-compose.production.yml'), 'utf8');
const requiredComposeMarkers = [
  'healthcheck:',
  'restart: unless-stopped',
  'networks:',
  'internal: true',
  'nginx:',
  'no-new-privileges:true',
  'max-size: "10m"',
];
const missingMarkers = requiredComposeMarkers.filter((marker) => !prodCompose.includes(marker));
if (missingMarkers.length) {
  console.error('[deploy-readiness] production compose is missing required markers:');
  for (const marker of missingMarkers) {
    console.error(`- ${marker}`);
  }
  process.exit(1);
}

console.log('[deploy-readiness] ok');

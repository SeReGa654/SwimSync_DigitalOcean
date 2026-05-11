import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const allowPlaceholders = args.includes('--allow-placeholders');
const pathArg = args.find((arg) => !arg.startsWith('--'));
const envPath = pathArg ? path.resolve(pathArg) : path.resolve('.env.production');
if (!fs.existsSync(envPath)) {
  console.error(`[prod-env-check] missing env file: ${envPath}`);
  process.exit(1);
}

const content = fs.readFileSync(envPath, 'utf8');
const lines = content
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'));

const map = new Map();
for (const line of lines) {
  const index = line.indexOf('=');
  if (index <= 0) continue;
  const key = line.slice(0, index).trim();
  const value = line.slice(index + 1).trim();
  map.set(key, value);
}

const required = [
  'APP_DOMAIN',
  'LETSENCRYPT_EMAIL',
  'POSTGRES_DB',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'DATABASE_URL',
  'FRONTEND_URL',
  'NEXT_PUBLIC_WS_URL',
  'AUTH_BOOTSTRAP_ADMIN_PASSWORD',
  'ADMIN_COOKIE_SECURE',
];

const missing = required.filter((key) => !map.get(key));
if (missing.length) {
  console.error('[prod-env-check] missing required keys:');
  missing.forEach((key) => console.error(`- ${key}`));
  process.exit(1);
}

const placeholderPatterns = [/change-me/i, /example\.com/i, /^localhost$/i, /<password>/i];
const insecureValues = [];
for (const [key, value] of map.entries()) {
  if (placeholderPatterns.some((pattern) => pattern.test(value))) {
    insecureValues.push(`${key}=${value}`);
  }
}

if (map.get('ADMIN_COOKIE_SECURE') !== 'true') {
  insecureValues.push('ADMIN_COOKIE_SECURE must be true');
}

if (!map.get('FRONTEND_URL')?.startsWith('https://')) {
  insecureValues.push('FRONTEND_URL must use https://');
}

if (!map.get('NEXT_PUBLIC_WS_URL')?.startsWith('https://')) {
  insecureValues.push('NEXT_PUBLIC_WS_URL must use https://');
}

if (!allowPlaceholders && insecureValues.length) {
  console.error('[prod-env-check] insecure or placeholder values detected:');
  insecureValues.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}

console.log('[prod-env-check] ok');

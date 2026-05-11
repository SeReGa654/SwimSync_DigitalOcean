function toNumber(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function splitCsv(value: string | undefined, fallback: string[]): string[] {
  if (!value) return fallback;
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export function getAppEnv() {
  const env = {
    backendPort: toNumber(process.env.BACKEND_PORT, 3001),
    trustedProxyHops: toNumber(process.env.TRUST_PROXY_HOPS, 0),
    frontendOrigins: splitCsv(process.env.FRONTEND_URL, ['http://localhost:3000']),
    docxServiceUrl: process.env.DOCX_SERVICE_URL || 'http://localhost:3012',
    docxRequestTimeoutMs: toNumber(process.env.DOCX_REQUEST_TIMEOUT_MS, 30000),
    docxUseQueue: toBoolean(process.env.DOCX_USE_QUEUE, true),
    docxQueuePollIntervalMs: toNumber(process.env.DOCX_QUEUE_POLL_INTERVAL_MS, 500),
    redisUrl: process.env.REDIS_URL?.trim() || '',
    globalRateLimitWindowMs: toNumber(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    globalRateLimitMax: toNumber(process.env.RATE_LIMIT_MAX, 1000),
    authLoginRateLimitMax: toNumber(process.env.AUTH_LOGIN_RATE_LIMIT_MAX, 20),
    exportRateLimitMax: toNumber(process.env.EXPORT_RATE_LIMIT_MAX, 120),
    adminCookieName: process.env.ADMIN_COOKIE_NAME?.trim() || 'admin_token',
    adminCookieMaxAgeMs: toNumber(process.env.ADMIN_COOKIE_MAX_AGE_MS, 12 * 60 * 60 * 1000),
    adminCookiePath: process.env.ADMIN_COOKIE_PATH?.trim() || '/',
    authRoleCookieName: process.env.AUTH_ROLE_COOKIE_NAME?.trim() || 'auth_role',
    csrfCookieName: process.env.CSRF_COOKIE_NAME?.trim() || 'csrf_token',
    adminCookieSameSite: ((process.env.ADMIN_COOKIE_SAME_SITE || 'lax').toLowerCase() === 'strict'
      || (process.env.ADMIN_COOKIE_SAME_SITE || 'lax').toLowerCase() === 'none'
      ? (process.env.ADMIN_COOKIE_SAME_SITE || 'lax').toLowerCase()
      : 'lax') as 'lax' | 'strict' | 'none',
    adminCookieSecure: process.env.ADMIN_COOKIE_SECURE
      ? process.env.ADMIN_COOKIE_SECURE.toLowerCase() === 'true'
      : process.env.NODE_ENV === 'production',
  };

  if (process.env.NODE_ENV === 'production') {
    const required = ['DATABASE_URL', 'AUTH_BOOTSTRAP_ADMIN_PASSWORD'];
    const missing = required.filter((key) => !process.env[key] || !process.env[key]?.trim());
    if (missing.length) {
      throw new Error(`Missing required production env vars: ${missing.join(', ')}`);
    }
    const hasLocalhostFrontend = env.frontendOrigins.some((origin) => origin.includes('localhost') || origin.includes('127.0.0.1'));
    if (hasLocalhostFrontend) {
      throw new Error('FRONTEND_URL must not use localhost in production');
    }
    if (!env.adminCookieSecure) {
      throw new Error('ADMIN_COOKIE_SECURE must be true in production');
    }
    if (env.adminCookieSameSite === 'none' && !env.adminCookieSecure) {
      throw new Error('ADMIN_COOKIE_SAME_SITE=none requires ADMIN_COOKIE_SECURE=true');
    }
  }

  return env;
}

export const appEnv = getAppEnv();


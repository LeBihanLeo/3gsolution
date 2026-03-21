// TICK-052 — SEC-03 : Rate limiting (OWASP A07:2021)
// Production : Upstash Redis + @upstash/ratelimit (plan gratuit)
// Développement : Map in-memory (pas de Redis requis)
//
// Configuration Upstash requise :
//   UPSTASH_REDIS_REST_URL=https://...
//   UPSTASH_REDIS_REST_TOKEN=...

// ─── Interface commune ────────────────────────────────────────────────────────

interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number; // timestamp Unix (secondes)
}

export interface RateLimitConfig {
  prefix: string;
  maxRequests: number;
  windowSeconds: number;
}

// ─── Presets ──────────────────────────────────────────────────────────────────

export const RATE_LIMIT_ADMIN_LOGIN: RateLimitConfig = {
  prefix: 'rl:login',
  maxRequests: 10,
  windowSeconds: 15 * 60,
};

export const RATE_LIMIT_CLIENT_LOGIN: RateLimitConfig = {
  prefix: 'rl:client-login',
  maxRequests: 10,
  windowSeconds: 15 * 60,
};

export const RATE_LIMIT_REGISTER: RateLimitConfig = {
  prefix: 'rl:register',
  maxRequests: 5,
  windowSeconds: 60 * 60,
};

export const RATE_LIMIT_PWD_RESET: RateLimitConfig = {
  prefix: 'rl:pwd-reset',
  maxRequests: 3,
  windowSeconds: 60 * 60,
};

export const RATE_LIMIT_PWD_CONFIRM: RateLimitConfig = {
  prefix: 'rl:pwd-confirm',
  maxRequests: 5,
  windowSeconds: 15 * 60,
};

// ─── Fallback in-memory (développement) ──────────────────────────────────────

interface InMemoryEntry {
  count: number;
  resetAt: number; // timestamp Unix (secondes)
}

// Global pour survivre au hot-reload Next.js en développement
const globalWithRL = global as typeof globalThis & {
  _rateLimitStores?: Map<string, Map<string, InMemoryEntry>>;
};

if (!globalWithRL._rateLimitStores) {
  globalWithRL._rateLimitStores = new Map();
}

function getStore(prefix: string): Map<string, InMemoryEntry> {
  const stores = globalWithRL._rateLimitStores!;
  if (!stores.has(prefix)) stores.set(prefix, new Map());
  return stores.get(prefix)!;
}

function inMemoryRateLimit(ip: string, config: RateLimitConfig): RateLimitResult {
  const now = Math.floor(Date.now() / 1000);
  const store = getStore(config.prefix);
  const entry = store.get(ip);

  if (!entry || now >= entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + config.windowSeconds });
    return { success: true, remaining: config.maxRequests - 1, reset: now + config.windowSeconds };
  }

  if (entry.count >= config.maxRequests) {
    return { success: false, remaining: 0, reset: entry.resetAt };
  }

  entry.count += 1;
  return { success: true, remaining: config.maxRequests - entry.count, reset: entry.resetAt };
}

// ─── Rate limiter principal ───────────────────────────────────────────────────

export async function checkRateLimit(ip: string, config: RateLimitConfig): Promise<RateLimitResult> {
  // Production avec Upstash Redis
  if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    try {
      const { Ratelimit } = await import('@upstash/ratelimit');
      const { Redis } = await import('@upstash/redis');

      const ratelimit = new Ratelimit({
        redis: Redis.fromEnv(),
        limiter: Ratelimit.slidingWindow(config.maxRequests, `${config.windowSeconds} s`),
        analytics: false,
        prefix: config.prefix,
      });

      const { success, remaining, reset } = await ratelimit.limit(ip);
      return { success, remaining, reset };
    } catch (err) {
      // TICK-063 — NEW-05 : fail-safe au lieu de fail-open
      // Si Upstash est indisponible, on bascule vers le rate-limiter in-memory
      // plutôt que de laisser passer toutes les requêtes — la protection reste active.
      console.error('[ratelimit] Upstash indisponible, fallback in-memory activé:', err);
      return inMemoryRateLimit(ip, config);
    }
  }

  // Développement : fallback in-memory
  return inMemoryRateLimit(ip, config);
}

// ─── Backward compat (admin login — middleware) ───────────────────────────────

export async function checkLoginRateLimit(ip: string): Promise<RateLimitResult> {
  return checkRateLimit(ip, RATE_LIMIT_ADMIN_LOGIN);
}

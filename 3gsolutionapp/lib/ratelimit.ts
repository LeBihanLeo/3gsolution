// TICK-052 — SEC-03 : Rate limiting sur le login admin (OWASP A07:2021)
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

// ─── Fallback in-memory (développement) ──────────────────────────────────────

interface InMemoryEntry {
  count: number;
  resetAt: number; // timestamp Unix (secondes)
}

const WINDOW_SECONDS = 15 * 60; // 15 minutes
const MAX_REQUESTS = 10;

// Global pour survivre au hot-reload Next.js en développement
const globalWithRL = global as typeof globalThis & {
  _loginAttempts?: Map<string, InMemoryEntry>;
};

if (!globalWithRL._loginAttempts) {
  globalWithRL._loginAttempts = new Map();
}

const loginAttempts = globalWithRL._loginAttempts;

function inMemoryRateLimit(ip: string): RateLimitResult {
  const now = Math.floor(Date.now() / 1000);
  const entry = loginAttempts.get(ip);

  if (!entry || now >= entry.resetAt) {
    // Nouvelle fenêtre
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_SECONDS });
    return { success: true, remaining: MAX_REQUESTS - 1, reset: now + WINDOW_SECONDS };
  }

  if (entry.count >= MAX_REQUESTS) {
    return { success: false, remaining: 0, reset: entry.resetAt };
  }

  entry.count += 1;
  return { success: true, remaining: MAX_REQUESTS - entry.count, reset: entry.resetAt };
}

// ─── Limiters spécialisés (TICK-078) ─────────────────────────────────────────

const REGISTER_MAX = 5;
const FORGOT_MAX = 3;
const CHECKOUT_MAX = 10; // 10 sessions Stripe max / 15 min par IP

const globalWithRL2 = global as typeof globalThis & {
  _registerAttempts?: Map<string, InMemoryEntry>;
  _forgotAttempts?: Map<string, InMemoryEntry>;
  _checkoutAttempts?: Map<string, InMemoryEntry>;
};

if (!globalWithRL2._registerAttempts) globalWithRL2._registerAttempts = new Map();
if (!globalWithRL2._forgotAttempts) globalWithRL2._forgotAttempts = new Map();
if (!globalWithRL2._checkoutAttempts) globalWithRL2._checkoutAttempts = new Map();

function inMemoryGenericLimit(
  map: Map<string, InMemoryEntry>,
  ip: string,
  maxReq: number
): RateLimitResult {
  const now = Math.floor(Date.now() / 1000);
  const entry = map.get(ip);
  if (!entry || now >= entry.resetAt) {
    map.set(ip, { count: 1, resetAt: now + WINDOW_SECONDS });
    return { success: true, remaining: maxReq - 1, reset: now + WINDOW_SECONDS };
  }
  if (entry.count >= maxReq) {
    return { success: false, remaining: 0, reset: entry.resetAt };
  }
  entry.count += 1;
  return { success: true, remaining: maxReq - entry.count, reset: entry.resetAt };
}

async function checkUpstashLimit(
  ip: string,
  prefix: string,
  maxReq: number,
  fallback: () => RateLimitResult
): Promise<RateLimitResult> {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const { Ratelimit } = await import('@upstash/ratelimit');
      const { Redis } = await import('@upstash/redis');
      const ratelimit = new Ratelimit({
        redis: Redis.fromEnv(),
        limiter: Ratelimit.slidingWindow(maxReq, `${WINDOW_SECONDS} s`),
        analytics: false,
        prefix,
      });
      const { success, remaining, reset } = await ratelimit.limit(ip);
      return { success, remaining, reset };
    } catch (err) {
      console.error(`[ratelimit] Upstash indisponible (${prefix}), fallback in-memory:`, err);
      return fallback();
    }
  }
  return fallback();
}

export async function checkCheckoutRateLimit(ip: string): Promise<RateLimitResult> {
  return checkUpstashLimit(
    ip,
    'rl:checkout',
    CHECKOUT_MAX,
    () => inMemoryGenericLimit(globalWithRL2._checkoutAttempts!, ip, CHECKOUT_MAX)
  );
}

export async function checkRegisterRateLimit(ip: string): Promise<RateLimitResult> {
  return checkUpstashLimit(
    ip,
    'rl:register',
    REGISTER_MAX,
    () => inMemoryGenericLimit(globalWithRL2._registerAttempts!, ip, REGISTER_MAX)
  );
}

export async function checkForgotPasswordRateLimit(ip: string): Promise<RateLimitResult> {
  return checkUpstashLimit(
    ip,
    'rl:forgot',
    FORGOT_MAX,
    () => inMemoryGenericLimit(globalWithRL2._forgotAttempts!, ip, FORGOT_MAX)
  );
}

// ─── Rate limiter principal ───────────────────────────────────────────────────

export async function checkLoginRateLimit(ip: string): Promise<RateLimitResult> {
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
        limiter: Ratelimit.slidingWindow(MAX_REQUESTS, `${WINDOW_SECONDS} s`),
        analytics: false,
        prefix: 'rl:login',
      });

      const { success, remaining, reset } = await ratelimit.limit(ip);
      return { success, remaining, reset };
    } catch (err) {
      // TICK-063 — NEW-05 : fail-safe au lieu de fail-open
      // Si Upstash est indisponible, on bascule vers le rate-limiter in-memory
      // plutôt que de laisser passer toutes les requêtes — la protection reste active.
      // Scénario d'attaque évité : saturer le plan gratuit Upstash puis brute-forcer sans limite.
      console.error('[ratelimit] Upstash indisponible, fallback in-memory activé:', err);
      return inMemoryRateLimit(ip);
    }
  }

  // Développement : fallback in-memory
  return inMemoryRateLimit(ip);
}

// Résolution du tenant depuis le hostname — Edge runtime compatible
// Importé par middleware.ts uniquement.
//
// Couches (dans l'ordre) :
//   1. DEV_TENANT_ID   — court-circuit dev restaurant unique, aucun appel réseau
//   2. Cache mémoire   — Map TTL 60 s, partagée dans le worker Edge
//   3. getDomains()    — LOCAL_DOMAINS en dev / Vercel Edge Config en prod
//   4. Fallback Mongo  — HTTP interne vers /api/tenant-resolver (cas rare)
//
// Le fallback Mongo déclenche un self-healing asynchrone côté serveur :
// /api/tenant-resolver resynchonise Edge Config après un miss.

import { getDomains } from '@/lib/local-edge-config';

// ── Cache mémoire (Edge worker) ───────────────────────────────────────────────
const tenantCache = new Map<string, { id: string; exp: number }>();
const CACHE_TTL_MS = 60_000;

export async function resolveTenantId(
  /** Valeur brute du header Host (peut inclure le port) */
  host: string,
  /** Origine de la requête courante — utilisée pour le fallback HTTP interne */
  internalBase: string
): Promise<string | null> {
  // ── 1. Développement local ────────────────────────────────────────────────
  // DEV_TENANT_ID fixe → aucune résolution réseau. Définir dans .env.local.
  const devId = process.env.DEV_TENANT_ID;
  if (devId && process.env.NODE_ENV !== 'production') return devId;

  const cleanHost = host.split(':')[0]; // retirer le port éventuel

  // ── 2. Cache mémoire ──────────────────────────────────────────────────────
  const cached = tenantCache.get(cleanHost);
  if (cached && cached.exp > Date.now()) return cached.id;

  // ── 3. getDomains() — LOCAL_DOMAINS (dev) ou Vercel Edge Config (prod) ───
  const domains = await getDomains();
  const id = domains?.[cleanHost] ?? null;
  if (id) {
    tenantCache.set(cleanHost, { id, exp: Date.now() + CACHE_TTL_MS });
    return id;
  }

  // ── 4. Fallback Mongo (HTTP interne) ─────────────────────────────────────
  // Cas rare : Edge Config non configuré, désynchronisé, ou premier démarrage.
  // /api/tenant-resolver résout en DB et déclenche un self-healing Edge Config.
  try {
    const url = `${internalBase}/api/tenant-resolver?host=${encodeURIComponent(host)}`;
    const res = await fetch(url, {
      headers: { 'x-internal-secret': process.env.NEXTAUTH_SECRET ?? '' },
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { id?: string };
    if (data.id) {
      tenantCache.set(cleanHost, { id: data.id, exp: Date.now() + CACHE_TTL_MS });
      return data.id;
    }
  } catch (err) {
    console.error('[tenant-resolver] fallback Mongo échoué :', err);
  }

  return null;
}

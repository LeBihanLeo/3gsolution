// Helpers Edge Config — écriture uniquement (Node.js runtime)
// Lecture faite depuis lib/tenant-resolver.ts via @vercel/edge-config (Edge-compatible)
//
// Variables d'env requises :
//   EDGE_CONFIG_ID  — identifiant du store (ex: ecfg_xxxx)
//   VERCEL_API_TOKEN — token Vercel avec accès écriture Edge Config

const EC_BASE = 'https://api.vercel.com/v1/edge-config';

interface EdgeConfigEnv {
  id: string;
  token: string;
}

function getEnv(): EdgeConfigEnv | null {
  const id = process.env.EDGE_CONFIG_ID;
  const token = process.env.VERCEL_API_TOKEN;
  if (!id || !token) return null;
  return { id, token };
}

async function readDomainsMap(id: string, token: string): Promise<Record<string, string>> {
  try {
    const res = await fetch(`${EC_BASE}/${id}/item/domains`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return {};
    const data = (await res.json()) as { value?: Record<string, string> };
    return data.value ?? {};
  } catch {
    return {};
  }
}

async function writeDomainsMap(
  id: string,
  token: string,
  domains: Record<string, string>
): Promise<void> {
  const res = await fetch(`${EC_BASE}/${id}/items`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      items: [{ operation: 'upsert', key: 'domains', value: domains }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Edge Config write failed (${res.status}): ${text}`);
  }
}

/**
 * Ajoute ou met à jour des entrées dans la map domains.
 * Retry 3× avec backoff exponentiel — non-bloquant en cas d'échec total.
 */
export async function upsertEdgeConfigDomains(entries: Record<string, string>): Promise<void> {
  const env = getEnv();
  if (!env) {
    console.warn('[edge-config] EDGE_CONFIG_ID ou VERCEL_API_TOKEN manquant — upsert ignoré');
    return;
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const current = await readDomainsMap(env.id, env.token);
      await writeDomainsMap(env.id, env.token, { ...current, ...entries });
      return;
    } catch (err) {
      console.error(`[edge-config] upsert tentative ${attempt}/3 échouée :`, err);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 200 * attempt));
    }
  }

  console.error('[edge-config] upsert échoué après 3 tentatives — Edge Config désynchronisé');
}

/**
 * Supprime des entrées de la map domains.
 * Best-effort : ne bloque pas le flux principal.
 */
export async function removeEdgeConfigDomains(domainsToRemove: string[]): Promise<void> {
  const env = getEnv();
  if (!env) {
    console.warn('[edge-config] EDGE_CONFIG_ID ou VERCEL_API_TOKEN manquant — suppression ignorée');
    return;
  }

  try {
    const current = await readDomainsMap(env.id, env.token);
    for (const d of domainsToRemove) delete current[d];
    await writeDomainsMap(env.id, env.token, current);
  } catch (err) {
    console.error('[edge-config] removeEdgeConfigDomains erreur :', err);
  }
}

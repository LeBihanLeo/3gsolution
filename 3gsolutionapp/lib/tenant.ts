// TICK-133 — Helper tenant : résout le restaurantId depuis x-tenant-host
// Utilise un cache module-level (Map) avec TTL 60s pour éviter un lookup DB par requête.
// Fonctionne en Node.js runtime (Server Components, API routes) — pas dans Edge middleware.
import { headers } from 'next/headers';
import { connectDB } from '@/lib/mongodb';
import Restaurant, { IRestaurant } from '@/models/Restaurant';

// Cache module-level (singleton par instance Node.js)
// host → { id, expiresAt }
const tenantCache = new Map<string, { id: string; expiresAt: number }>();

/**
 * Résout le restaurantId depuis le host header x-tenant-host.
 * En développement (localhost / 127.0.0.1), utilise DEV_TENANT_ID ou le premier restaurant en DB.
 */
export async function resolveTenantId(host: string): Promise<string | null> {
  const isLocalhost =
    host.startsWith('localhost') || host.startsWith('127.0.0.1');

  // Dev : utiliser DEV_TENANT_ID ou le premier restaurant en DB
  if (isLocalhost && process.env.NODE_ENV !== 'production') {
    if (process.env.DEV_TENANT_ID) return process.env.DEV_TENANT_ID;

    // Fallback : premier restaurant en DB
    await connectDB();
    const first = await Restaurant.findOne().select('_id').lean();
    return first ? first._id.toString() : null;
  }

  // Cache TTL 60s
  const cached = tenantCache.get(host);
  if (cached && cached.expiresAt > Date.now()) return cached.id;

  await connectDB();
  const restaurant = await Restaurant.findOne({ domaine: host }).select('_id').lean();
  if (!restaurant) {
    // DEBUG temporaire — à retirer après correction
    const all = await Restaurant.find().select('domaine').lean();
    console.error(`[tenant] Domaine "${host}" introuvable. Domaines en base :`, all.map(r => r.domaine));
    return null;
  }

  const id = restaurant._id.toString();
  tenantCache.set(host, { id, expiresAt: Date.now() + 60_000 });
  return id;
}

/**
 * Lit x-tenant-host injecté par le middleware et retourne le restaurantId MongoDB.
 * Lève une erreur si le tenant ne peut pas être résolu.
 */
export async function getTenantId(): Promise<string> {
  const headerStore = await headers();
  const host = headerStore.get('x-tenant-host') ?? 'localhost';
  const tenantId = await resolveTenantId(host);
  if (!tenantId) {
    throw new Error(`Tenant non résolu pour le domaine "${host}"`);
  }
  return tenantId;
}

/**
 * Retourne le document Restaurant complet du tenant courant.
 */
export async function getTenantRestaurant(): Promise<IRestaurant | null> {
  const headerStore = await headers();
  const host = headerStore.get('x-tenant-host') ?? 'localhost';

  const isLocalhost =
    host.startsWith('localhost') || host.startsWith('127.0.0.1');

  await connectDB();

  if (isLocalhost && process.env.NODE_ENV !== 'production') {
    if (process.env.DEV_TENANT_ID) {
      return Restaurant.findById(process.env.DEV_TENANT_ID).lean();
    }
    return Restaurant.findOne().lean();
  }

  return Restaurant.findOne({ domaine: host }).lean();
}

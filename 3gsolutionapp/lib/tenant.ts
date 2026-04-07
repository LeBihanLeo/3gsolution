// TICK-133 — Helper tenant : lecture de x-tenant-id depuis les headers Next.js
import { headers } from 'next/headers';
import mongoose from 'mongoose';

/**
 * Lit le header x-tenant-id injecté par le middleware (TICK-132) et le retourne
 * sous forme de mongoose.Types.ObjectId.
 * Lance une erreur 400 si le header est absent ou invalide.
 */
export async function getTenantId(
  hdrs?: Headers | Awaited<ReturnType<typeof headers>>
): Promise<mongoose.Types.ObjectId> {
  const h = hdrs ?? (await headers());
  const raw = h.get('x-tenant-id');

  if (!raw) {
    throw Object.assign(new Error('x-tenant-id header manquant'), { status: 400 });
  }

  if (!mongoose.Types.ObjectId.isValid(raw)) {
    throw Object.assign(new Error('x-tenant-id invalide'), { status: 400 });
  }

  return new mongoose.Types.ObjectId(raw);
}

/**
 * Résout le restaurantId pour les routes admin protégées.
 * Priorité : header x-tenant-id (injecté par middleware) → session.user.id (fallback JWT signé).
 * Le fallback couvre les cas où le fetch interne _tenant échoue (Turbopack dev, réseau).
 */
export async function resolveTenantForAdmin(
  session: { user: { id?: string } }
): Promise<mongoose.Types.ObjectId | null> {
  const fromHeader = await getTenantId().catch(() => null);
  if (fromHeader) return fromHeader;

  const userId = session.user.id;
  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    return new mongoose.Types.ObjectId(userId);
  }

  return null;
}

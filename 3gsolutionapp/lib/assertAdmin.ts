// CVE-02 — Helper de vérification de rôle admin (défense en profondeur)
// Utilisé dans chaque handler API admin en complément du middleware.
// Le middleware (Edge) protège au niveau du routage, mais ne garantit pas
// que tous les chemins sont couverts. Chaque handler doit vérifier
// indépendamment le rôle pour éviter les IDOR et escalades de privilège.
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';

export interface AdminSession {
  user: {
    id?: string;
    email?: string | null;
    name?: string | null;
    role: string;
  };
}

/**
 * Vérifie que l'utilisateur est authentifié ET possède le rôle 'admin'.
 * Retourne `{ session }` en cas de succès, ou `{ error: NextResponse }` sinon.
 *
 * Usage :
 * ```ts
 * const check = await requireAdmin();
 * if (check.error) return check.error;
 * const { session } = check;
 * ```
 */
export async function requireAdmin(): Promise<
  | { session: AdminSession; error: null }
  | { session: null; error: NextResponse }
> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return {
      session: null,
      error: NextResponse.json({ error: 'Non autorisé.' }, { status: 401 }),
    };
  }

  if ((session.user as { role?: string }).role !== 'admin') {
    return {
      session: null,
      error: NextResponse.json({ error: 'Accès refusé.' }, { status: 403 }),
    };
  }

  return { session: session as unknown as AdminSession, error: null };
}

// Abstraction Edge Config : objet local (dev) vs Vercel Edge Config (prod)
//
// Développement — deux modes :
//   1. Restaurant unique → définir DEV_TENANT_ID dans .env.local
//      lib/tenant-resolver.ts court-circuite dès la couche 1, ce fichier n'est pas consulté
//
//   2. Multi-tenant local → laisser DEV_TENANT_ID vide, renseigner LOCAL_DOMAINS ci-dessous
//      Pointer les hostnames custom dans le fichier hosts système :
//        Windows : C:\Windows\System32\drivers\etc\hosts
//        Mac/Linux : /etc/hosts
//        Exemple : 127.0.0.1  resto-a.local

const LOCAL_DOMAINS: Record<string, string> = {
  // localhost → restaurant par défaut (même _id que DEV_TENANT_ID si défini)
  // localhost: process.env.DEV_TENANT_ID ?? '',

  // Multi-tenant local : décommenter et renseigner les ObjectId Mongo réels
  'resto-a.test': '69d36cc94d5eb89cfd203fa9',
  'resto-b.test': '683a1b2c3d4e5f6a7b8c9d0f',
};

/**
 * Retourne la map { domaine → tenantId }.
 * - Dev  : LOCAL_DOMAINS (aucun appel réseau, aucune dépendance Vercel)
 * - Prod : Vercel Edge Config (dynamic import pour éviter l'init sans EDGE_CONFIG)
 */
export async function getDomains(): Promise<Record<string, string> | null> {
  if (process.env.NODE_ENV !== 'production') {
    return LOCAL_DOMAINS;
  }

  // Prod uniquement — dynamic import pour ne pas initialiser le module sans EDGE_CONFIG
  try {
    const { get } = await import('@vercel/edge-config');
    return (await get<Record<string, string>>('domains')) ?? null;
  } catch {
    return null; // EDGE_CONFIG absent ou timeout → fallback Mongo dans tenant-resolver.ts
  }
}

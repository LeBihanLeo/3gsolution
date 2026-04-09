// TICK-145 — Validation returnTo contre les domaines enregistrés en DB
// Sécurité : empêche les open redirects (un attaquant ne peut pas forger un returnTo arbitraire)
import { connectDB } from '@/lib/mongodb';
import Restaurant from '@/models/Restaurant';

export async function assertKnownDomain(returnTo: string): Promise<void> {
  let domaine: string;
  try {
    const url = new URL(returnTo);
    // Conserver le port s'il est non-standard (80/443) pour matcher le format stocké en DB
    // Ex dev : "resto-a.local:3000", Ex prod : "resto-a.com"
    domaine =
      url.port && url.port !== '443' && url.port !== '80'
        ? `${url.hostname}:${url.port}`
        : url.hostname;
  } catch {
    throw new Error('returnTo invalide : URL malformée');
  }

  await connectDB();
  // Lookup dans Restaurant.domaine — liste authoritative des domaines de la plateforme
  const exists = await Restaurant.exists({ domaine });
  if (!exists) {
    throw new Error(`Domaine non autorisé : ${domaine}`);
  }
}

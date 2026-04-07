// TICK-132 — Route interne : résolution tenant par host header (fallback Mongo)
// Appelée uniquement par lib/tenant-resolver.ts quand Edge Config est absent/désynchronisé.
// Sur un hit Mongo, déclenche un self-healing Edge Config asynchrone.
// NON exposée publiquement — exclue du middleware matcher.
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Restaurant from '@/models/Restaurant';
import { upsertEdgeConfigDomains } from '@/lib/edge-config';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  console.log('[_tenant] GET appelé, url=', req.url);

  try {
    // Clé secrète simple pour éviter l'abus de cette route interne
    const secret = req.headers.get('x-internal-secret');
    if (secret !== process.env.NEXTAUTH_SECRET) {
      console.log('[_tenant] Forbidden — secret invalide');
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const host = req.nextUrl.searchParams.get('host');
    if (!host) {
      return NextResponse.json({ error: 'host manquant' }, { status: 400 });
    }

    console.log('[_tenant] host=', host);

    await connectDB();

    const hostWithoutPort = host.split(':')[0];

    const restaurant = await Restaurant.findOne({
      $or: [
        { domaine: host },
        { domaine: hostWithoutPort },
        { domainesAlternatifs: host },
        { domainesAlternatifs: hostWithoutPort },
      ],
    }).select('_id');

    console.log('[_tenant] findOne résultat:', restaurant ? restaurant._id.toString() : 'null');

    if (restaurant) {
      const id = restaurant._id.toString();

      // Self-healing : resynchroniser Edge Config en arrière-plan
      // Permet de corriger automatiquement un miss Edge Config sans bloquer la réponse.
      upsertEdgeConfigDomains({ [hostWithoutPort]: id }).catch((err) =>
        console.error('[tenant-resolver] resync Edge Config échoué :', err)
      );

      return NextResponse.json({ id });
    }

    // Fallback dev/preview : localhost, *.localhost ou *.vercel.app → premier restaurant (ordre createdAt ASC)
    const isDevOrPreview =
      host.startsWith('localhost') ||
      host.startsWith('127.0.0.1') ||
      host.endsWith('.localhost') ||
      hostWithoutPort.endsWith('.localhost') ||
      host.endsWith('.vercel.app');

    console.log('[_tenant] isDevOrPreview=', isDevOrPreview);

    if (isDevOrPreview) {
      // Tentative de résolution par slug : "restoa.localhost:3000" → slug "restoa"
      const subdomainPart = hostWithoutPort.split('.')[0];
      if (subdomainPart && subdomainPart !== 'localhost' && subdomainPart !== '127') {
        const bySlug = await Restaurant.findOne({ slug: subdomainPart }).select('_id');
        if (bySlug) {
          console.log('[_tenant] résolu par slug:', bySlug._id.toString());
          return NextResponse.json({ id: bySlug._id.toString(), fallback: true });
        }
        console.log('[_tenant] aucun restaurant avec slug=', subdomainPart);
      }

      // Dernier recours : premier restaurant créé (localhost sans sous-domaine)
      const seed = await Restaurant.findOne({}).sort({ createdAt: 1 }).select('_id');
      console.log('[_tenant] seed:', seed ? seed._id.toString() : 'AUCUN RESTAURANT EN DB');
      if (seed) {
        return NextResponse.json({ id: seed._id.toString(), fallback: true });
      }
    }

    return NextResponse.json({ error: 'Restaurant introuvable' }, { status: 404 });
  } catch (err) {
    console.error('[_tenant] ERREUR:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

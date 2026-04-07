// TICK-135 — GET/PUT /api/site-config lit désormais Restaurant (multi-tenant) au lieu du singleton SiteConfig.
// SiteConfig est conservé marqué @deprecated et sera supprimé après validation en production.
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/mongodb';
import { requireAdmin } from '@/lib/assertAdmin';
import Restaurant from '@/models/Restaurant';
import { generatePalette } from '@/lib/palette';
import { getTenantId, resolveTenantForAdmin } from '@/lib/tenant';

const DEFAULT_COULEUR = '#E63946';

const DEFAULT_CONFIG = {
  nomRestaurant: 'Mon Restaurant',
  horaireOuverture: '11:30',
  horaireFermeture: '14:00',
  fermeeAujourdhui: false,
  couleurPrincipale: DEFAULT_COULEUR,
};

// HH:MM format validation
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const SiteConfigZod = z.object({
  nomRestaurant: z.string().min(1).max(80).optional(),
  banniereUrl: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^https?:\/\//.test(val) || val.startsWith('/'),
      { message: "L'URL doit être HTTPS ou un chemin relatif (/...)" }
    ),
  horaireOuverture: z.string().regex(timeRegex, 'Format attendu HH:MM').optional(),
  horaireFermeture: z.string().regex(timeRegex, 'Format attendu HH:MM').optional(),
  fermeeAujourdhui: z.boolean().optional(),
  couleurPrincipale: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Format attendu #RRGGBB')
    .optional(),
}).refine(
  (data) => {
    if (data.horaireOuverture && data.horaireFermeture) {
      return data.horaireFermeture > data.horaireOuverture;
    }
    return true;
  },
  { message: "L'heure de fermeture doit être après l'heure d'ouverture", path: ['horaireFermeture'] }
);

const NO_STORE = { 'Cache-Control': 'no-store' };

// Champs publics retournés — stripeSecretKey et stripeWebhookSecret JAMAIS exposés.
// stripePublishableKey inclus : nécessaire côté client pour Stripe Elements.
const PUBLIC_SELECT = 'nomRestaurant banniereUrl couleurPrincipale horaireOuverture horaireFermeture fermeeAujourdhui stripePublishableKey';

// GET /api/site-config — public
// TICK-119/120 — no-store : valeur fraîche (fermeeAujourdhui, horaires)
// TICK-122  — palette calculée à la volée
// TICK-135  — lit le restaurant du tenant courant
export async function GET() {
  try {
    const restaurantId = await getTenantId().catch(() => null);

    await connectDB();

    const config = restaurantId
      ? await Restaurant.findById(restaurantId).select(PUBLIC_SELECT).lean()
      : null;

    if (!config) {
      const palette = generatePalette(DEFAULT_COULEUR);
      return NextResponse.json(
        { data: { ...DEFAULT_CONFIG, palette } },
        { headers: NO_STORE }
      );
    }

    const c = config as Record<string, unknown>;
    const couleur = (typeof c.couleurPrincipale === 'string' && c.couleurPrincipale) ? c.couleurPrincipale : DEFAULT_COULEUR;
    const palette = generatePalette(couleur);

    return NextResponse.json({
      data: {
        nomRestaurant: (typeof c.nomRestaurant === 'string' && c.nomRestaurant) ? c.nomRestaurant : DEFAULT_CONFIG.nomRestaurant,
        banniereUrl: typeof c.banniereUrl === 'string' ? c.banniereUrl : undefined,
        horaireOuverture: (typeof c.horaireOuverture === 'string' && c.horaireOuverture) ? c.horaireOuverture : DEFAULT_CONFIG.horaireOuverture,
        horaireFermeture: (typeof c.horaireFermeture === 'string' && c.horaireFermeture) ? c.horaireFermeture : DEFAULT_CONFIG.horaireFermeture,
        fermeeAujourdhui: typeof c.fermeeAujourdhui === 'boolean' ? c.fermeeAujourdhui : DEFAULT_CONFIG.fermeeAujourdhui,
        couleurPrincipale: couleur,
        stripePublishableKey: typeof c.stripePublishableKey === 'string' ? c.stripePublishableKey : undefined,
        palette,
      },
    }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// PUT /api/site-config — admin : met à jour le restaurant du tenant courant
export async function PUT(request: NextRequest) {
  // CVE-02 — vérification de rôle 'admin'
  const check = await requireAdmin();
  if (check.error) return check.error;

  try {
    const restaurantId = await resolveTenantForAdmin(check.session);
    if (!restaurantId) {
      return NextResponse.json({ error: 'Tenant non résolu' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = SiteConfigZod.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    await connectDB();
    // TICK-135 — mise à jour du restaurant du tenant (jamais d'un autre)
    const config = await Restaurant.findByIdAndUpdate(
      restaurantId,
      { $set: parsed.data },
      { new: true, select: PUBLIC_SELECT }
    ).lean();

    if (!config) {
      return NextResponse.json({ error: 'Restaurant introuvable' }, { status: 404 });
    }

    return NextResponse.json({ data: config });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// TICK-135 — site-config délègue au document Restaurant du tenant courant.
// @deprecated SiteConfig singleton → Restaurant multi-tenant
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/mongodb';
import { requireAdmin } from '@/lib/assertAdmin';
import { getTenantId, getTenantRestaurant } from '@/lib/tenant';
import Restaurant from '@/models/Restaurant';
import { generatePalette } from '@/lib/palette';

const DEFAULT_COULEUR = '#E63946';

const DEFAULT_CONFIG = {
  nomRestaurant: 'Mon Restaurant',
  horaireOuverture: '11:30',
  horaireFermeture: '14:00',
  fermeeAujourdhui: false,
  couleurPrincipale: DEFAULT_COULEUR,
};

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

// GET /api/site-config — public
export async function GET() {
  try {
    await connectDB();
    const restaurant = await getTenantRestaurant();

    if (!restaurant) {
      const palette = generatePalette(DEFAULT_COULEUR);
      return NextResponse.json(
        { data: { ...DEFAULT_CONFIG, palette } },
        { headers: NO_STORE }
      );
    }

    const couleur = restaurant.couleurPrimaire ?? DEFAULT_COULEUR;
    const palette = generatePalette(couleur);

    return NextResponse.json({
      data: {
        nomRestaurant: restaurant.nom ?? DEFAULT_CONFIG.nomRestaurant,
        banniereUrl: restaurant.banniere ?? undefined,
        horaireOuverture: restaurant.horaireOuverture ?? DEFAULT_CONFIG.horaireOuverture,
        horaireFermeture: restaurant.horaireFermeture ?? DEFAULT_CONFIG.horaireFermeture,
        fermeeAujourdhui: restaurant.fermeeAujourdhui ?? DEFAULT_CONFIG.fermeeAujourdhui,
        couleurPrincipale: couleur,
        palette,
      },
    }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// PUT /api/site-config — admin : met à jour le restaurant courant
export async function PUT(request: NextRequest) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  try {
    const restaurantId = await getTenantId();
    const body = await request.json();
    const parsed = SiteConfigZod.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    await connectDB();

    // Mapping champs SiteConfig → Restaurant
    const update: Record<string, unknown> = {};
    if (parsed.data.nomRestaurant !== undefined) update.nom = parsed.data.nomRestaurant;
    if (parsed.data.banniereUrl !== undefined) update.banniere = parsed.data.banniereUrl;
    if (parsed.data.horaireOuverture !== undefined) update.horaireOuverture = parsed.data.horaireOuverture;
    if (parsed.data.horaireFermeture !== undefined) update.horaireFermeture = parsed.data.horaireFermeture;
    if (parsed.data.fermeeAujourdhui !== undefined) update.fermeeAujourdhui = parsed.data.fermeeAujourdhui;
    if (parsed.data.couleurPrincipale !== undefined) update.couleurPrimaire = parsed.data.couleurPrincipale;

    const restaurant = await Restaurant.findByIdAndUpdate(
      restaurantId,
      { $set: update },
      { new: true }
    ).lean();

    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant introuvable' }, { status: 404 });
    }

    return NextResponse.json({ data: restaurant });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

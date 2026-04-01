import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { connectDB } from '@/lib/mongodb';
import { authOptions } from '@/lib/auth';
import SiteConfig from '@/models/SiteConfig';
import { generatePalette } from '@/lib/palette';

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
  // TICK-100 — Horaires d'ouverture
  horaireOuverture: z
    .string()
    .regex(timeRegex, 'Format attendu HH:MM')
    .optional(),
  horaireFermeture: z
    .string()
    .regex(timeRegex, 'Format attendu HH:MM')
    .optional(),
  // TICK-105 — Fermeture manuelle
  fermeeAujourdhui: z.boolean().optional(),
  // TICK-122 — couleur principale hex
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
// TICK-119/120 — no-store : la valeur doit être fraîche à chaque requête (fermeeAujourdhui, horaires)
// TICK-122 — retourne aussi la palette calculée à la volée (non stockée)
export async function GET() {
  try {
    await connectDB();
    const config = await SiteConfig.findOne().select('-__v -_id').lean();
    if (!config) {
      const palette = generatePalette(DEFAULT_COULEUR);
      return NextResponse.json(
        { data: { ...DEFAULT_CONFIG, palette } },
        { headers: NO_STORE }
      );
    }
    const couleur = (config as { couleurPrincipale?: string }).couleurPrincipale ?? DEFAULT_COULEUR;
    const palette = generatePalette(couleur);
    // Merge defaults pour les anciens documents sans horaireOuverture/horaireFermeture
    return NextResponse.json({ data: { ...DEFAULT_CONFIG, ...config, palette } }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// PUT /api/site-config — admin
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = SiteConfigZod.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    await connectDB();
    // $set : mise à jour partielle (ne supprime pas les champs non envoyés)
    const config = await SiteConfig.findOneAndUpdate(
      {},
      { $set: parsed.data },
      { upsert: true, new: true, select: '-__v -_id' }
    ).lean();

    return NextResponse.json({ data: config });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

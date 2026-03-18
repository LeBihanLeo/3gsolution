import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { connectDB } from '@/lib/mongodb';
import { authOptions } from '@/lib/auth';
import SiteConfig from '@/models/SiteConfig';

const DEFAULT_CONFIG = {
  nomRestaurant: 'Mon Restaurant',
};

const SiteConfigZod = z.object({
  nomRestaurant: z.string().min(1).max(80),
  banniereUrl: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^https?:\/\//.test(val) || val.startsWith('/'),
      { message: "L'URL doit être HTTPS ou un chemin relatif (/...)" }
    ),
});

// GET /api/site-config — public
export async function GET() {
  try {
    await connectDB();
    const config = await SiteConfig.findOne().select('-__v -_id').lean();
    if (!config) {
      return NextResponse.json({ data: DEFAULT_CONFIG });
    }
    return NextResponse.json({ data: config });
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
    const config = await SiteConfig.findOneAndUpdate(
      {},
      { ...parsed.data, updatedAt: new Date() },
      { upsert: true, new: true, select: '-__v -_id' }
    ).lean();

    return NextResponse.json({ data: config });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

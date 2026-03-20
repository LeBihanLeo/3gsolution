// TICK-034 — API Upload d'images
// TICK-053 — SEC-04 : Validation MIME par magic bytes (OWASP A03:2021, CWE-434)
// Vercel Blob en production, fallback local (public/uploads/) si BLOB_READ_WRITE_TOKEN absent
//
// Sécurité :
// - Le type MIME est détecté depuis les magic bytes du fichier (pas depuis file.type)
// - Le nom de fichier est systématiquement remplacé par un UUID (plus de path traversal)
// - Authentification admin obligatoire
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { fileTypeFromBuffer } from 'file-type';
import { logger } from '@/lib/logger';

// Types MIME autorisés (liste blanche stricte)
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 Mo

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'Fichier trop volumineux (maximum 5 Mo)' },
        { status: 413 }
      );
    }

    // ── Validation MIME par magic bytes ───────────────────────────────────────
    // SEC-04 : on lit le contenu réel du fichier, pas l'en-tête Content-Type
    // fourni par le client (trivialement falsifiable avec curl ou Burp Suite)
    const buffer = Buffer.from(await file.arrayBuffer());
    const detected = await fileTypeFromBuffer(buffer);

    if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) {
      const ip =
        request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
      logger.warn('upload_invalid_mime', {
        ip,
        detectedMime: detected?.mime ?? 'unknown',
        route: '/api/upload',
      });
      return NextResponse.json(
        {
          error:
            'Type de fichier invalide. Seuls JPEG, PNG, WebP et GIF sont acceptés.',
        },
        { status: 400 }
      );
    }

    // ── Nom de fichier sûr (UUID) ─────────────────────────────────────────────
    // SEC-05 : le nom original du fichier est ignoré pour éviter path traversal,
    // caractères spéciaux et autres vecteurs d'attaque via le nom de fichier.
    const ext = MIME_TO_EXT[detected.mime] ?? 'bin';
    const safeFilename = `${randomUUID()}.${ext}`;

    // ── Mode production : Vercel Blob ────────────────────────────────────────
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { put } = await import('@vercel/blob');
      const blob = await put(safeFilename, buffer, { access: 'public' });
      return NextResponse.json({ url: blob.url });
    }

    // ── Mode développement : stockage local dans public/uploads/ ─────────────
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.writeFile(path.join(uploadsDir, safeFilename), buffer);

    return NextResponse.json({ url: `/uploads/${safeFilename}` });
  } catch (err) {
    logger.error('upload_failed', { route: '/api/upload' }, err);
    return NextResponse.json({ error: "Erreur lors de l'upload" }, { status: 500 });
  }
}

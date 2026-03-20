import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@vercel/blob', () => ({
  put: vi.fn().mockResolvedValue({ url: 'https://blob.vercel-storage.com/test.jpg' }),
}));

// TICK-053 — fileTypeFromBuffer est une dépendance ESM (file-type v19+) et ne peut pas
// analyser les fichiers de test synthétiques (bytes nuls sans magic bytes réels).
// On mocke le module comme toutes les autres dépendances tierces.
vi.mock('file-type', () => ({
  fileTypeFromBuffer: vi.fn(),
}));

// Mock fs pour éviter les écritures disque (default + named exports)
vi.mock('fs/promises', () => {
  const mockMkdir = vi.fn().mockResolvedValue(undefined);
  const mockWriteFile = vi.fn().mockResolvedValue(undefined);
  return {
    default: { mkdir: mockMkdir, writeFile: mockWriteFile },
    mkdir: mockMkdir,
    writeFile: mockWriteFile,
  };
});

import { getServerSession } from 'next-auth';
import { fileTypeFromBuffer } from 'file-type';
import { POST } from '@/app/api/upload/route';

const makeFile = (name: string, type: string, sizeBytes = 100) => {
  const content = new Uint8Array(sizeBytes);
  return new File([content], name, { type });
};

/** Crée un NextRequest et stub `formData()` pour retourner les données en Node.js */
const makeReq = (file?: File) => {
  const formData = new FormData();
  if (file) formData.append('file', file);
  const req = new NextRequest('http://localhost/api/upload', { method: 'POST' });
  (req as unknown as Record<string, unknown>).formData = vi.fn().mockResolvedValue(formData);
  return req;
};

describe('POST /api/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('sans session → 401', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    // La vérification de session est avant fileTypeFromBuffer — pas de mock nécessaire
    const res = await POST(makeReq(makeFile('img.jpg', 'image/jpeg')));
    expect(res.status).toBe(401);
  });

  it('fichier non-image (PDF) → 400', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: {} } as ReturnType<typeof getServerSession> extends Promise<infer T> ? T : never);
    // fileTypeFromBuffer retourne undefined → type non reconnu → 400
    vi.mocked(fileTypeFromBuffer).mockResolvedValueOnce(undefined);
    const res = await POST(makeReq(makeFile('doc.pdf', 'application/pdf')));
    expect(res.status).toBe(400);
  });

  it('fichier > 5 Mo → 413', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: {} } as ReturnType<typeof getServerSession> extends Promise<infer T> ? T : never);
    // La vérification de taille est avant fileTypeFromBuffer — pas de mock nécessaire
    const oversized = makeFile('big.jpg', 'image/jpeg', 6 * 1024 * 1024);
    const res = await POST(makeReq(oversized));
    expect(res.status).toBe(413);
  });

  it('image JPEG valide avec BLOB_READ_WRITE_TOKEN → retourne URL Vercel Blob', async () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_fake');
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: {} } as ReturnType<typeof getServerSession> extends Promise<infer T> ? T : never);
    // fileTypeFromBuffer retourne image/jpeg → passe la validation
    vi.mocked(fileTypeFromBuffer).mockResolvedValueOnce({ mime: 'image/jpeg', ext: 'jpg' });
    const { put } = await import('@vercel/blob');
    vi.mocked(put).mockResolvedValueOnce({ url: 'https://blob.vercel-storage.com/test.jpg' } as ReturnType<typeof put> extends Promise<infer T> ? T : never);
    const res = await POST(makeReq(makeFile('img.jpg', 'image/jpeg')));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.url).toContain('blob.vercel-storage.com');
  });

  it('image JPEG sans BLOB_READ_WRITE_TOKEN → fallback local, retourne /uploads/...', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: {} } as ReturnType<typeof getServerSession> extends Promise<infer T> ? T : never);
    // fileTypeFromBuffer retourne image/jpeg → passe la validation → fallback local
    vi.mocked(fileTypeFromBuffer).mockResolvedValueOnce({ mime: 'image/jpeg', ext: 'jpg' });
    const res = await POST(makeReq(makeFile('img.jpg', 'image/jpeg')));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.url).toMatch(/^\/uploads\/.+\.jpg$/);
  });
});

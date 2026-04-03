import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
const mockS3Send = vi.fn().mockResolvedValue({});
vi.mock('@aws-sdk/client-s3', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function S3Client(this: any) { this.send = mockS3Send; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function PutObjectCommand(this: any, input: unknown) { Object.assign(this, input); }
  return { S3Client, PutObjectCommand };
});

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

  it('image JPEG valide avec CLOUDFLARE_R2_ACCOUNT_ID → retourne URL R2', async () => {
    vi.stubEnv('CLOUDFLARE_R2_ACCOUNT_ID', 'fake-account-id');
    vi.stubEnv('CLOUDFLARE_R2_ACCESS_KEY_ID', 'fake-key');
    vi.stubEnv('CLOUDFLARE_R2_SECRET_ACCESS_KEY', 'fake-secret');
    vi.stubEnv('CLOUDFLARE_R2_BUCKET_NAME', 'my-bucket');
    vi.stubEnv('CLOUDFLARE_R2_PUBLIC_URL', 'https://cdn.example.com');
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: {} } as ReturnType<typeof getServerSession> extends Promise<infer T> ? T : never);
    vi.mocked(fileTypeFromBuffer).mockResolvedValueOnce({ mime: 'image/jpeg', ext: 'jpg' });
    const res = await POST(makeReq(makeFile('img.jpg', 'image/jpeg')));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.url).toMatch(/^https:\/\/cdn\.example\.com\/.+\.jpg$/);
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

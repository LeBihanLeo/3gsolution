// TICK-138 — Super-admin JWT : sign/verify avec Web Crypto API
// Compatible Edge runtime (middleware) et Node.js (API routes).
// Audience "superadmin" séparé des sessions NextAuth admin/client.

const AUDIENCE = 'superadmin';
const TTL_SECONDS = 8 * 60 * 60; // 8 heures

function b64urlEncode(str: string): string {
  return btoa(str).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function b64urlDecode(str: string): string {
  return atob(str.replace(/-/g, '+').replace(/_/g, '/'));
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signSuperadminToken(email: string): Promise<string> {
  const secret = process.env.SUPERADMIN_JWT_SECRET;
  if (!secret) throw new Error('SUPERADMIN_JWT_SECRET manquant');

  const header = b64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64urlEncode(
    JSON.stringify({
      email,
      aud: AUDIENCE,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + TTL_SECONDS,
    })
  );

  const key = await importKey(secret);
  const sigBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${header}.${payload}`)
  );
  const sig = b64urlEncode(String.fromCharCode(...new Uint8Array(sigBuffer)));

  return `${header}.${payload}.${sig}`;
}

export async function verifySuperadminToken(token: string): Promise<{ email: string } | null> {
  const secret = process.env.SUPERADMIN_JWT_SECRET;
  if (!secret) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const key = await importKey(secret);
    const sigBytes = Uint8Array.from(b64urlDecode(parts[2]), (c) => c.charCodeAt(0));
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    );
    if (!isValid) return null;

    const payload = JSON.parse(b64urlDecode(parts[1])) as {
      email?: string;
      aud?: string;
      exp?: number;
    };
    if (payload.aud !== AUDIENCE) return null;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!payload.email) return null;

    return { email: payload.email };
  } catch {
    return null;
  }
}

// TICK-186 — Implémentation TOTP (RFC 6238) avec le module crypto natif Node.js
// Aucune dépendance externe — compatible partout où Node.js fonctionne.

import { createHmac, randomBytes } from 'crypto';

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// ── Encodage base32 ───────────────────────────────────────────────────────────
export function base32Encode(buf: Buffer): string {
  let result = '';
  let bits = 0;
  let current = 0;
  for (const byte of buf) {
    current = (current << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result += BASE32_CHARS[(current >> bits) & 0x1f];
    }
  }
  if (bits > 0) result += BASE32_CHARS[(current << (5 - bits)) & 0x1f];
  return result;
}

// ── Décodage base32 ───────────────────────────────────────────────────────────
function base32Decode(encoded: string): Buffer {
  const clean = encoded.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  const bytes: number[] = [];
  let bits = 0;
  let current = 0;
  for (const char of clean) {
    const val = BASE32_CHARS.indexOf(char);
    if (val === -1) continue;
    current = (current << 5) | val;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((current >> bits) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

// ── HOTP (RFC 4226) ───────────────────────────────────────────────────────────
function hotp(key: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) {
    buf[i] = c & 0xff;
    c = Math.floor(c / 256);
  }
  const hmac = createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

// ── API publique ──────────────────────────────────────────────────────────────

/** Génère un secret TOTP aléatoire encodé en base32. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** Génère le code TOTP courant pour un secret donné. */
export function generateTotp(secret: string): string {
  const counter = Math.floor(Date.now() / 1000 / 30);
  return hotp(base32Decode(secret), counter);
}

/**
 * Vérifie un code TOTP avec une fenêtre de ±1 step (±30s) pour absorber le décalage horloge.
 * Utilise une comparaison à temps constant pour éviter les timing attacks.
 */
export function verifyTotp(token: string, secret: string): boolean {
  if (!/^\d{6}$/.test(token)) return false;
  const counter = Math.floor(Date.now() / 1000 / 30);
  const key = base32Decode(secret);
  for (let delta = -1; delta <= 1; delta++) {
    const expected = hotp(key, counter + delta);
    // Comparaison caractère par caractère à temps constant
    if (token.length === expected.length && constantTimeEqual(token, expected)) return true;
  }
  return false;
}

function constantTimeEqual(a: string, b: string): boolean {
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Génère l'URI otpauth pour le QR code. */
export function totpKeyUri(secret: string, account: string, issuer: string): string {
  return (
    `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}` +
    `?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`
  );
}

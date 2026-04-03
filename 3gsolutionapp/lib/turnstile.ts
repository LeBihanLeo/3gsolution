/**
 * Cloudflare Turnstile — vérification côté serveur.
 *
 * Si CLOUDFLARE_TURNSTILE_SECRET_KEY n'est pas définie (dev local),
 * la vérification est sautée et la fonction retourne true.
 */
export async function verifyTurnstile(token: string | null | undefined): Promise<boolean> {
  const secret = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;

  // Dev / CI sans clé configurée → on passe
  if (!secret) return true;

  if (!token || typeof token !== 'string') return false;

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, response: token }),
  });

  const data = (await res.json()) as { success: boolean };
  return data.success === true;
}

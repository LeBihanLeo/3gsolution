'use client';

import { Turnstile } from '@marsidev/react-turnstile';

interface TurnstileWidgetProps {
  onToken: (token: string | null) => void;
}

/**
 * Turnstile silencieux (invisible).
 * Rend rien de visible — le challenge tourne en arrière-plan.
 * Appelle onToken(token) quand Cloudflare valide la session,
 * onToken(null) si expiration ou erreur.
 */
export function TurnstileWidget({ onToken }: TurnstileWidgetProps) {
  const siteKey = process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY;

  // Pas de clé configurée (dev local) → on ne rend rien
  if (!siteKey) return null;

  return (
    <Turnstile
      siteKey={siteKey}
      appearance="invisible"
      onSuccess={onToken}
      onError={() => onToken(null)}
      onExpire={() => onToken(null)}
    />
  );
}

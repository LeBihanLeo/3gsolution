'use client';

import { useEffect, useRef } from 'react';
import { signIn } from 'next-auth/react';

export default function GoogleStartPage() {
  const initiated = useRef(false);

  useEffect(() => {
    // Guard contre le double-invoke de React StrictMode en développement.
    // Sans cette protection, le second appel écrase le cookie d'état OAuth
    // du premier, causant "State cookie was missing" au retour de Google.
    if (initiated.current) return;
    initiated.current = true;
    void signIn('google', { callbackUrl: '/api/auth/cross-domain-hub' });
  }, []);

  return (
    <div className="text-center text-sm text-gray-500">
      Redirection vers Google&hellip;
    </div>
  );
}

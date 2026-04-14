// Layout minimaliste pour les pages internes du hub (flow OAuth cross-domain).
// Pas d'en-tête restaurant, pas de panier — ces pages ne sont pas destinées aux clients.
import type { ReactNode } from 'react';

export default function HubLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      {children}
    </div>
  );
}

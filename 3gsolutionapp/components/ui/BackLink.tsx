// TICK-084 — Composant BackLink (flèche retour avec texte)
import Link from 'next/link';

interface BackLinkProps {
  href: string;
  label: string;
}

export function BackLink({ href, label }: BackLinkProps) {
  return (
    <Link
      href={href}
      aria-label={`Retour — ${label}`}
      className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 hover:underline transition-colors"
    >
      <span aria-hidden="true">←</span>
      <span>{label}</span>
    </Link>
  );
}

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
      className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-orange-600 transition-colors group"
    >
      <span
        aria-hidden="true"
        className="text-base transition-transform group-hover:-translate-x-0.5"
      >
        ←
      </span>
      <span>{label}</span>
    </Link>
  );
}

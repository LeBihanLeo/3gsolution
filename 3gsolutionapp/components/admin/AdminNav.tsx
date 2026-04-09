'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';

export default function AdminNav() {
  const pathname = usePathname();

  const navLink = (href: string, label: string) => {
    const active = pathname.startsWith(href);
    return (
      <Link
        href={href}
        className={`px-4 min-h-[44px] flex items-center rounded-lg text-sm font-medium transition-colors ${
          active
            ? 'bg-blue-600 text-white'
            : 'text-gray-900 hover:bg-gray-100'
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    // TICK-117 — overflow-x-auto pour tablette, hauteur de touch ≥ 44px sur les liens nav
    <nav className="bg-white border-b shadow-sm overflow-x-auto">
      <div className="min-w-[768px] max-w-5xl mx-auto px-4 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="font-bold text-gray-900 mr-4 py-3">Admin</span>
          {navLink('/admin/commandes', 'Commandes')}
          {navLink('/admin/menu', 'Menu')}
          {navLink('/admin/personnalisation', 'Personnalisation')}
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/admin/login' })}
          className="text-sm text-gray-800 hover:text-red-600 hover:underline transition-colors min-h-[44px] font-medium"
        >
          Se déconnecter
        </button>
      </div>
    </nav>
  );
}

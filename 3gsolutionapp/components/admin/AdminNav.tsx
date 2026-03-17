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
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          active
            ? 'bg-blue-600 text-white'
            : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <nav className="bg-white border-b shadow-sm">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="font-bold text-gray-900 mr-4">Admin</span>
          {navLink('/admin/commandes', 'Commandes')}
          {navLink('/admin/menu', 'Menu')}
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/admin/login' })}
          className="text-sm text-gray-500 hover:text-red-500 hover:underline transition-colors"
        >
          Se déconnecter
        </button>
      </div>
    </nav>
  );
}

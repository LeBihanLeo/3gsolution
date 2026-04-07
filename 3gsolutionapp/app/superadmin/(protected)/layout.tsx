// TICK-138 — Layout superadmin protégé (auth vérifiée par le middleware)
import type { ReactNode } from 'react';
import LogoutButton from '@/components/superadmin/LogoutButton';

export default function SuperadminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <span className="font-bold text-lg text-gray-900">3G Solution</span>
          <span className="ml-3 text-xs text-indigo-600 uppercase tracking-widest font-medium">
            Super Admin
          </span>
        </div>
        <LogoutButton />
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}

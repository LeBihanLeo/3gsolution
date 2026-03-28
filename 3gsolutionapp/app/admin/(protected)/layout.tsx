import type { ReactNode } from 'react';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import AdminNav from '@/components/admin/AdminNav';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/admin/login');

  return (
    <div className="min-h-screen bg-gray-100">
      <AdminNav />
      {/* TICK-117 — overflow-x-auto pour tablette, min-w pour éviter le scroll horizontal sur le nav */}
      <div className="overflow-x-auto">
        <main className="min-w-[768px] max-w-5xl mx-auto px-4 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}

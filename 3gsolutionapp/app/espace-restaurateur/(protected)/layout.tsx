import type { ReactNode } from 'react';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import Restaurant from '@/models/Restaurant';
import AdminNav from '@/components/admin/AdminNav';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/espace-restaurateur/login');

  // TICK-191 — Redirect vers onboarding si première connexion admin.
  // La page onboarding est hors du groupe (protected) → pas de boucle possible.
  const user = session.user as { role?: string; restaurantId?: string };
  if (user?.role === 'admin' && user?.restaurantId) {
    await connectDB();
    const restaurant = await Restaurant.findById(user.restaurantId)
      .select('onboardingCompleted')
      .lean();
    if (restaurant && !restaurant.onboardingCompleted) {
      redirect('/espace-restaurateur/onboarding');
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <AdminNav />
      {/* TICK-117 — overflow-x-auto pour tablette, min-w pour éviter le scroll horizontal sur le nav */}
      <div className="overflow-x-auto">
        <main className="min-w-[768px] w-[85%] mx-auto px-4 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}

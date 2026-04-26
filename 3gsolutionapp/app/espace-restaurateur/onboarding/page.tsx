// TICK-192 — Page onboarding admin (hors layout protégé — pas de sidebar nav)
// Déclenchée depuis le layout (protected) quand onboardingCompleted=false.
import { Suspense } from 'react';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import OnboardingWizard from '@/components/admin/onboarding/OnboardingWizard';

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/espace-restaurateur/login');

  const user = session.user as { role?: string };
  if (user?.role !== 'admin') redirect('/espace-restaurateur/login');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex flex-col">
      <Suspense fallback={
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        <OnboardingWizard />
      </Suspense>
    </div>
  );
}

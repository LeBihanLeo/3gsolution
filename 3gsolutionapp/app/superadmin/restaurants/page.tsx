'use client';

// TICK-138 — Page liste restaurants (super-admin)
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';

interface RestaurantItem {
  _id: string;
  nom: string;
  domaine: string;
  slug: string;
  adminEmail: string;
  couleurPrimaire: string;
  createdAt: string;
}

export default function SuperAdminRestaurantsPage() {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<RestaurantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/superadmin/restaurants')
      .then((r) => {
        if (r.status === 403) { router.push('/superadmin/login'); return null; }
        return r.json();
      })
      .then((data) => {
        if (data?.data) setRestaurants(data.data);
        setLoading(false);
      })
      .catch(() => { setError('Erreur de chargement'); setLoading(false); });
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Restaurants</h1>
            <p className="text-gray-400 text-sm">3G Solution — Super Administration</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/superadmin/restaurants/nouveau')}
              className="bg-white text-gray-900 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-100"
            >
              + Nouveau restaurant
            </button>
            <button
              onClick={() => signOut({ callbackUrl: '/superadmin/login' })}
              className="text-gray-400 hover:text-white text-sm px-3 py-2"
            >
              Déconnexion
            </button>
          </div>
        </div>

        {loading && <p className="text-gray-400">Chargement…</p>}
        {error && <p className="text-red-400">{error}</p>}

        {!loading && !error && restaurants.length === 0 && (
          <p className="text-gray-400">Aucun restaurant. Créez le premier.</p>
        )}

        <div className="grid gap-4">
          {restaurants.map((r) => (
            <div key={r._id} className="bg-gray-800 rounded-xl p-5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full border border-gray-600"
                    style={{ backgroundColor: r.couleurPrimaire }}
                  />
                  <span className="font-semibold">{r.nom}</span>
                  <span className="text-gray-400 text-sm font-mono">{r.domaine}</span>
                </div>
                <p className="text-gray-400 text-sm mt-1">Admin : {r.adminEmail}</p>
              </div>
              <button
                onClick={() => router.push(`/superadmin/restaurants/${r._id}`)}
                className="text-sm text-gray-300 hover:text-white underline"
              >
                Modifier
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

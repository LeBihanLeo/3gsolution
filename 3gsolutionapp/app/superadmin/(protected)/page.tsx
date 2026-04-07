// TICK-138 — Super-admin : tableau de bord (liste des restaurants)
// Server Component — lecture directe de la DB (auth garantie par middleware)
import Link from 'next/link';
import { connectDB } from '@/lib/mongodb';
import Restaurant from '@/models/Restaurant';
import Produit from '@/models/Produit';
import Commande from '@/models/Commande';

async function getRestaurants() {
  await connectDB();
  const restaurants = await Restaurant.find({})
    .select('nomRestaurant slug domaine adminEmail createdAt')
    .lean();

  return Promise.all(
    restaurants.map(async (r) => {
      const [nbProduits, nbCommandes] = await Promise.all([
        Produit.countDocuments({ restaurantId: r._id }),
        Commande.countDocuments({ restaurantId: r._id }),
      ]);
      return { ...r, nbProduits, nbCommandes };
    })
  );
}

export default async function SuperadminDashboard() {
  const restaurants = await getRestaurants();

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Restaurants</h1>
        <Link
          href="/superadmin/nouveau"
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Nouveau restaurant
        </Link>
      </div>

      {restaurants.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center text-gray-400 border border-gray-200">
          <p className="text-lg mb-2">Aucun restaurant pour l&apos;instant.</p>
          <p className="text-sm">
            <Link href="/superadmin/nouveau" className="text-indigo-600 hover:underline">
              Créer le premier restaurant
            </Link>
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider bg-gray-50">
                <th className="text-left px-6 py-3">Restaurant</th>
                <th className="text-left px-6 py-3">Slug / Domaine</th>
                <th className="text-left px-6 py-3">Email admin</th>
                <th className="text-right px-6 py-3">Produits</th>
                <th className="text-right px-6 py-3">Commandes</th>
                <th className="text-left px-6 py-3">Créé le</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {restaurants.map((r) => (
                <tr
                  key={String(r._id)}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4 font-medium text-gray-900">{r.nomRestaurant}</td>
                  <td className="px-6 py-4 text-gray-600">
                    <span className="font-mono text-indigo-600">{r.slug}</span>
                    <br />
                    <span className="text-gray-400 text-xs">{r.domaine}</span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{r.adminEmail}</td>
                  <td className="px-6 py-4 text-right text-gray-600">{r.nbProduits}</td>
                  <td className="px-6 py-4 text-right text-gray-600">{r.nbCommandes}</td>
                  <td className="px-6 py-4 text-gray-400 text-xs">
                    {new Date(r.createdAt as Date).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/superadmin/${String(r._id)}`}
                      className="text-indigo-600 hover:text-indigo-700 text-xs font-medium"
                    >
                      Modifier →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

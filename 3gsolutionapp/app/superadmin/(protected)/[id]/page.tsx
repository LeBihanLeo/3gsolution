// TICK-138 — Édition restaurant (domaine, admin, Stripe)
// Server Component pour chargement initial, Client Component pour le formulaire
import { notFound } from 'next/navigation';
import { connectDB } from '@/lib/mongodb';
import Restaurant from '@/models/Restaurant';
import EditRestaurantForm from '@/components/superadmin/EditRestaurantForm';

type Params = { params: Promise<{ id: string }> };

async function getRestaurant(id: string) {
  await connectDB();
  // Ne pas sélectionner les champs secrets (adminPasswordHash, stripeSecretKey, stripeWebhookSecret)
  const restaurant = await Restaurant.findById(id)
    .select(
      'nomRestaurant slug domaine domainesAlternatifs adminEmail stripePublishableKey horaireOuverture horaireFermeture couleurPrincipale fermeeAujourdhui emailFrom'
    )
    .lean();
  return restaurant;
}

export default async function EditRestaurantPage({ params }: Params) {
  const { id } = await params;

  // Validation basique de l'ObjectId avant requête DB
  if (!/^[a-f\d]{24}$/i.test(id)) notFound();

  const restaurant = await getRestaurant(id);
  if (!restaurant) notFound();

  return (
    <div className="max-w-2xl">
      <EditRestaurantForm restaurant={{ ...restaurant, _id: String(restaurant._id) }} />
    </div>
  );
}

import { permanentRedirect } from 'next/navigation';

export default function AdminDashboardPage() {
  permanentRedirect('/espace-restaurateur/commandes');
}

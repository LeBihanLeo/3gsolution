'use client';

import { CommandeData } from '@/components/admin/CommandeRow';

function formatPrix(centimes: number): string {
  return (centimes / 100).toFixed(2).replace('.', ',') + ' €';
}

function startOfTodayParis(): Date {
  const now = new Date();
  const parisStr = now.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });
  const [day, month, year] = parisStr.split('/').map(Number);
  return new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00`);
}

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col gap-1">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

interface KpiCardsProps {
  commandes: CommandeData[];
  loading: boolean;
}

export default function KpiCards({ commandes, loading }: KpiCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-gray-200 rounded-xl h-24 animate-pulse" />
        ))}
      </div>
    );
  }

  const today = startOfTodayParis();

  const commandesAujourdhui = commandes.filter(
    (c) => new Date(c.createdAt) >= today && c.statut !== 'en_attente_paiement'
  );
  const commandesEnCours = commandes.filter(
    (c) => c.statut === 'payee' || c.statut === 'en_preparation'
  );
  const commandesRecuperees = commandes.filter(
    (c) => c.statut === 'recuperee' && new Date(c.createdAt) >= today
  );
  const caAujourdhui = commandesAujourdhui.reduce((sum, c) => sum + c.total, 0);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
      <KpiCard
        label="Commandes"
        value={commandesAujourdhui.length}
        sub="payées aujourd'hui"
      />
      <KpiCard
        label="CA du jour"
        value={formatPrix(caAujourdhui)}
        sub="toutes commandes payées"
      />
      <KpiCard
        label="En cours"
        value={commandesEnCours.length}
        sub="à préparer / en préparation"
      />
      <KpiCard
        label="Récupérées"
        value={commandesRecuperees.length}
        sub="aujourd'hui"
      />
    </div>
  );
}

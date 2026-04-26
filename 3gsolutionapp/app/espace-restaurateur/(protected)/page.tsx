'use client';

// TICK-103 — Dashboard admin : KPIs + 4 dernières commandes en cours + nav rapide
// TICK-199 — OnboardingReminderBanner si Stripe non connecté

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { CommandeData } from '@/components/admin/CommandeRow';
import OnboardingReminderBanner from '@/components/admin/OnboardingReminderBanner';

const POLL_INTERVAL_MS = 30_000;

function formatPrix(centimes: number): string {
  return (centimes / 100).toFixed(2).replace('.', ',') + ' €';
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col gap-1">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

// ─── Nav Card ────────────────────────────────────────────────────────────────

function NavCard({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link
      href={href}
      className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-3 hover:shadow-md transition-shadow group"
    >
      <span className="text-2xl">{icon}</span>
      <span className="font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">
        {label}
      </span>
      <span className="ml-auto text-gray-300 group-hover:text-blue-400 text-lg">→</span>
    </Link>
  );
}

// ─── Mini commande card ───────────────────────────────────────────────────────

const STATUT_LABELS: Record<string, string> = {
  payee: 'Payée',
  en_preparation: 'En préparation',
  prete: 'Prête',
};

const STATUT_COLORS: Record<string, string> = {
  payee: 'bg-blue-100 text-blue-700',
  en_preparation: 'bg-amber-100 text-amber-700',
  prete: 'bg-green-100 text-green-700',
};

function MiniCommandeCard({ commande }: { commande: CommandeData }) {
  const createdAt = new Date(commande.createdAt);
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 truncate">{commande.client.nom}</p>
        <p className="text-xs text-gray-500">
          {commande.produits.length} article(s) · {formatPrix(commande.total)}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {createdAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
      <span
        className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-full ${
          STATUT_COLORS[commande.statut] ?? 'bg-gray-100 text-gray-600'
        }`}
      >
        {STATUT_LABELS[commande.statut] ?? commande.statut}
      </span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const [commandes, setCommandes] = useState<CommandeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [stripeConnected, setStripeConnected] = useState(true); // optimiste par défaut

  const fetchCommandes = useCallback(async () => {
    try {
      const res = await fetch('/api/commandes');
      if (!res.ok) throw new Error('Erreur API');
      const data = await res.json();
      setCommandes(data.data ?? []);
      setLastSync(new Date());
    } catch {
      // silencieux — dashboard
    } finally {
      setLoading(false);
    }
  }, []);

  // TICK-199 — Vérifie le statut Stripe pour la bannière reminder
  useEffect(() => {
    fetch('/api/admin/stripe-status')
      .then((r) => r.json())
      .then((d) => setStripeConnected(d.connected === true))
      .catch(() => {}); // silencieux
  }, []);

  useEffect(() => {
    fetchCommandes();
  }, [fetchCommandes]);

  useEffect(() => {
    const interval = setInterval(fetchCommandes, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchCommandes]);

  const today = startOfToday();

  // KPIs du jour
  const commandesAujourdhui = commandes.filter(
    (c) => new Date(c.createdAt) >= today
  );
  const commandesEnCours = commandes.filter(
    (c) => c.statut === 'payee' || c.statut === 'en_preparation'
  );
  const commandesRecuperees = commandes.filter(
    (c) => c.statut === 'recuperee' && new Date(c.createdAt) >= today
  );
  const caAujourdhui = commandesAujourdhui
    .filter((c) => c.statut !== 'en_attente_paiement')
    .reduce((sum, c) => sum + c.total, 0);

  // 4 dernières commandes en cours (payee + en_preparation + prete)
  const dernieres = commandes
    .filter((c) => ['payee', 'en_preparation', 'prete'].includes(c.statut))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4);

  return (
    <div className="space-y-8">
      {/* TICK-199 — Bannière reminder Stripe */}
      <OnboardingReminderBanner stripeConnected={stripeConnected} />

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        {lastSync && (
          <p className="text-xs text-gray-400">
            Mis à jour à {lastSync.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        )}
      </div>

      {/* KPIs */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Aujourd&apos;hui
        </h2>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-200 rounded-xl h-24 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <KpiCard
              label="Commandes"
              value={commandesAujourdhui.filter((c) => c.statut !== 'en_attente_paiement').length}
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
        )}
      </section>

      {/* Dernières commandes en cours */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Commandes en cours
          </h2>
          <Link href="/espace-restaurateur/commandes" className="text-xs text-blue-600 hover:underline">
            Voir toutes →
          </Link>
        </div>

        {loading && (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="bg-gray-200 rounded-xl h-20 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && dernieres.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-8">
            Aucune commande en cours.
          </p>
        )}

        {!loading && dernieres.length > 0 && (
          <div className="space-y-3">
            {dernieres.map((c) => (
              <MiniCommandeCard key={c._id} commande={c} />
            ))}
          </div>
        )}
      </section>

      {/* Navigation rapide */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Accès rapide
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <NavCard href="/espace-restaurateur/commandes" label="Commandes" icon="📋" />
          <NavCard href="/espace-restaurateur/menu" label="Menu" icon="🍽" />
          <NavCard href="/espace-restaurateur/personnalisation" label="Personnalisation" icon="🎨" />
        </div>
      </section>
    </div>
  );
}

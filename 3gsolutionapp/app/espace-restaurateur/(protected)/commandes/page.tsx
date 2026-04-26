'use client';

// TICK-104 — Section "Récupérées aujourd'hui" + transitions complètes
// TICK-105 — Toggle fermeture boutique
// TICK-106 — Export CSV
// TICK-121 — Fix filtre "Récupérées aujourd'hui" avec heure locale Paris
// TICK-124 — 2 onglets "En cours" / "Passées"
// TICK-125 — Export CSV dans l'onglet "Passées", filtré statut=recuperee
// TICK-126 — Timeline verticale groupée par jour/mois/année dans l'onglet Passées
// TICK-127 — Modale d'export CSV avec mode plage / mois / année
// TICK-128 — Rétraction des sections timeline (année/mois/jour)
// TICK-129 — Fix contraste label nb commandes timeline
// TICK-130 — Modale export : uniquement les dates ayant des données
// TICK-131 — Fix "Récupérées aujourd'hui" : utiliser recupereeAt au lieu de createdAt

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import CommandeRow, { CommandeData, StatutCommande } from '@/components/admin/CommandeRow';
import OrderCard from '@/components/admin/OrderCard';
import KpiCards from '@/components/admin/KpiCards';
import OnboardingReminderBanner from '@/components/admin/OnboardingReminderBanner';

const POLL_INTERVAL_MS = 10_000;

type Onglet = 'en_cours' | 'passees';
type ExportMode = 'plage' | 'mois' | 'annee';


const MOIS_NOMS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

// TICK-121 — Minuit local Europe/Paris pour comparaison
function startOfTodayParis(): Date {
  const now = new Date();
  const parisStr = now.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });
  const [day, month, year] = parisStr.split('/').map(Number);
  return new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00`);
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// TICK-126 — Groupement timeline
interface TimelineGroup {
  key: string;       // YYYY-MM-DD
  monthKey: string;  // YYYY-MM
  year: number;
  month: number;     // 0-indexed
  dayLabel: string;
  monthLabel: string;
  commandes: CommandeData[];
  showYear: boolean;
  showMonth: boolean;
}

function buildTimelineGroups(commandes: CommandeData[]): TimelineGroup[] {
  const map = new Map<string, CommandeData[]>();

  for (const c of commandes) {
    const key = toDateStr(new Date(c.createdAt));
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(c);
  }

  const keys = [...map.keys()].sort((a, b) => b.localeCompare(a));

  const raw = keys.map((key) => {
    const d = new Date(key + 'T12:00:00');
    const year = d.getFullYear();
    const month = d.getMonth();
    return {
      key,
      monthKey: `${year}-${String(month + 1).padStart(2, '0')}`,
      year,
      month,
      dayLabel: d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
      monthLabel: d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      commandes: map.get(key)!,
    };
  });

  return raw.map((g, i) => ({
    ...g,
    showYear: i === 0 || raw[i - 1].year !== g.year,
    showMonth: i === 0 || raw[i - 1].month !== g.month || raw[i - 1].year !== g.year,
  }));
}

export default function AdminCommandesPage() {
  const [commandes, setCommandes] = useState<CommandeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [error, setError] = useState(false);

  // TICK-124 — Onglet actif
  const [onglet, setOnglet] = useState<Onglet>('en_cours');

  // TICK-105 — Fermeture boutique
  const [fermeeAujourdhui, setFermeeAujourdhui] = useState(false);
  const [loadingFermeture, setLoadingFermeture] = useState(false);
  const [showConfirmFermer, setShowConfirmFermer] = useState(false);
  const [stripeConnected, setStripeConnected] = useState(true);

  // TICK-127 — Modale export
  const [showExportModal, setShowExportModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMode, setExportMode] = useState<ExportMode>('mois');
  const [exportFrom, setExportFrom] = useState(() =>
    toDateStr(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  );
  const [exportTo, setExportTo] = useState(() => toDateStr(new Date()));
  // TICK-131 — 2 selects pour le mode mois
  const [exportMoisYear, setExportMoisYear] = useState(() => String(new Date().getFullYear()));
  const [exportMoisMonth, setExportMoisMonth] = useState(() => String(new Date().getMonth())); // 0-indexed
  const [exportAnnee, setExportAnnee] = useState(() => String(new Date().getFullYear()));

  // Ligne dépliée dans la table "Récupérées aujourd'hui"
  const [expandedRecupId, setExpandedRecupId] = useState<string | null>(null);

  // TICK-128 — État rétraction timeline
  const [collapsedYears, setCollapsedYears] = useState<Set<number>>(new Set());
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());

  const toggleYear = (year: number) =>
    setCollapsedYears((prev) => { const s = new Set(prev); s.has(year) ? s.delete(year) : s.add(year); return s; });

  const toggleMonth = (mk: string) =>
    setCollapsedMonths((prev) => { const s = new Set(prev); s.has(mk) ? s.delete(mk) : s.add(mk); return s; });

  const toggleDay = (dk: string) =>
    setCollapsedDays((prev) => { const s = new Set(prev); s.has(dk) ? s.delete(dk) : s.add(dk); return s; });

  const fetchCommandes = useCallback(async () => {
    try {
      const res = await fetch('/api/commandes');
      if (!res.ok) throw new Error('Erreur API');
      const data = await res.json();
      setCommandes(data.data ?? []);
      setLastSync(new Date());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch('/api/site-config', { cache: 'no-store' })
      .then((r) => r.json())
      .then(({ data }) => setFermeeAujourdhui(data?.fermeeAujourdhui ?? false))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/admin/stripe-status')
      .then((r) => r.json())
      .then((d) => setStripeConnected(d.connected === true))
      .catch(() => {});
  }, []);

  useEffect(() => { fetchCommandes(); }, [fetchCommandes]);

  useEffect(() => {
    const interval = setInterval(fetchCommandes, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchCommandes]);

  // ── Avancer statut — TICK-099, TICK-104 ──────────────────────────────────

  const advanceStatut = async (id: string, statut: StatutCommande) => {
    await fetch(`/api/commandes/${id}/statut`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut }),
    });
    const now = new Date().toISOString();
    setCommandes((prev) =>
      prev.map((c) =>
        c._id === id
          ? {
              ...c,
              statut,
              ...(statut === 'en_preparation' ? { enPreparationAt: now } : {}),
              ...(statut === 'prete' ? { preteAt: now } : {}),
              ...(statut === 'recuperee' ? { recupereeAt: now } : {}),
            }
          : c
      )
    );
  };

  // ── Supprimer — TICK-057 ──────────────────────────────────────────────────

  const handleSupprimer = async (id: string) => {
    await fetch(`/api/commandes/${id}`, { method: 'DELETE' });
    setCommandes((prev) => prev.filter((c) => c._id !== id));
  };

  // ── Fermer/rouvrir boutique — TICK-105 ───────────────────────────────────

  const toggleFermeture = async (fermer: boolean) => {
    setLoadingFermeture(true);
    try {
      const res = await fetch('/api/site-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fermeeAujourdhui: fermer }),
      });
      if (res.ok) setFermeeAujourdhui(fermer);
    } catch { /* silencieux */ }
    finally {
      setLoadingFermeture(false);
      setShowConfirmFermer(false);
    }
  };

  // ── Données disponibles pour l'export — TICK-130 ─────────────────────────

  const commandesPassees = useMemo(
    () =>
      commandes
        .filter((c) => c.statut === 'recuperee' || c.statut === 'remboursee')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [commandes]
  );

  // Années ayant des données (depuis createdAt)
  const availableYears = useMemo(() => {
    const s = new Set<number>();
    for (const c of commandesPassees) s.add(new Date(c.createdAt).getFullYear());
    return [...s].sort((a, b) => b - a);
  }, [commandesPassees]);

  // Map year → mois 0-indexed disponibles
  const availableMonthsByYear = useMemo(() => {
    const map = new Map<number, number[]>();
    for (const c of commandesPassees) {
      const d = new Date(c.createdAt);
      const y = d.getFullYear();
      const m = d.getMonth();
      if (!map.has(y)) map.set(y, []);
      const arr = map.get(y)!;
      if (!arr.includes(m)) arr.push(m);
    }
    for (const arr of map.values()) arr.sort((a, b) => b - a);
    return map;
  }, [commandesPassees]);

  // Valeurs effectives pour les selects (fallback si sélection hors dispo)
  const effectiveExportAnnee = availableYears.includes(parseInt(exportAnnee))
    ? exportAnnee
    : String(availableYears[0] ?? new Date().getFullYear());

  const effectiveMoisYear = availableYears.includes(parseInt(exportMoisYear))
    ? exportMoisYear
    : String(availableYears[0] ?? new Date().getFullYear());

  const availableMonthsForMoisYear = availableMonthsByYear.get(parseInt(effectiveMoisYear)) ?? [];

  const effectiveMoisMonth = availableMonthsForMoisYear.includes(parseInt(exportMoisMonth))
    ? exportMoisMonth
    : String(availableMonthsForMoisYear[0] ?? new Date().getMonth());

  // ── Export CSV — TICK-127, TICK-130 ──────────────────────────────────────

  const computeExportRange = (): { from: string; to: string } => {
    if (exportMode === 'plage') return { from: exportFrom, to: exportTo };
    if (exportMode === 'mois') {
      const year = parseInt(effectiveMoisYear);
      const month = parseInt(effectiveMoisMonth); // 0-indexed
      const lastDay = new Date(year, month + 1, 0).getDate();
      return {
        from: `${year}-${String(month + 1).padStart(2, '0')}-01`,
        to: `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
      };
    }
    return { from: `${effectiveExportAnnee}-01-01`, to: `${effectiveExportAnnee}-12-31` };
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const { from, to } = computeExportRange();
      const res = await fetch(`/api/admin/commandes/export?statut=recuperee&from=${from}&to=${to}`);
      if (!res.ok) throw new Error('Erreur export');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `commandes-passees-${from}-${to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setShowExportModal(false);
    } catch {
      alert("Erreur lors de l'export CSV.");
    } finally {
      setExporting(false);
    }
  };

  // ── Filtres ───────────────────────────────────────────────────────────────

  const today = startOfTodayParis();

  const sortByCreatedAt = (a: CommandeData, b: CommandeData) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  const sortByEnPreparationAt = (a: CommandeData, b: CommandeData) =>
    new Date(a.enPreparationAt ?? a.createdAt).getTime() - new Date(b.enPreparationAt ?? b.createdAt).getTime();
  const sortByPreteAt = (a: CommandeData, b: CommandeData) =>
    new Date(a.preteAt ?? a.createdAt).getTime() - new Date(b.preteAt ?? b.createdAt).getTime();

  const commandesEnAttente = commandes.filter((c) => c.statut === 'payee').sort(sortByCreatedAt);
  const commandesEnPreparation = commandes.filter((c) => c.statut === 'en_preparation').sort(sortByEnPreparationAt);
  const commandesPrêtes = commandes.filter((c) => c.statut === 'prete').sort(sortByPreteAt);

  // Commandes du jour (createdAt aujourd'hui) avec statut recuperee
  const commandesRecupereesAujourdHui = commandes.filter((c) => {
    if (c.statut !== 'recuperee') return false;
    const d = new Date(c.createdAt);
    return !isNaN(d.getTime()) && d >= today;
  });

  const nbEnCours = commandesEnAttente.length + commandesEnPreparation.length + commandesPrêtes.length;

  // TICK-126 — Timeline
  const timelineGroups = buildTimelineGroups(commandesPassees);

  return (
    <div>
      {/* Modale confirmation fermeture */}
      {showConfirmFermer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Confirmer la fermeture ?</h3>
            <p className="text-sm text-gray-500 mb-5">Aucune nouvelle commande ne sera acceptée.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmFermer(false)}
                className="flex-1 border border-gray-200 text-gray-700 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => toggleFermeture(true)}
                disabled={loadingFermeture}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
              >
                {loadingFermeture ? '…' : 'Fermer la boutique'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TICK-127 — Modale export CSV */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-gray-900">Exporter les commandes passées</h3>
              <button onClick={() => setShowExportModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors text-lg leading-none">✕</button>
            </div>

            {/* Sélecteur de mode */}
            <div className="flex gap-2 mb-5">
              {(['plage', 'mois', 'annee'] as ExportMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setExportMode(mode)}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    exportMode === mode
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {mode === 'plage' ? 'Plage' : mode === 'mois' ? 'Par mois' : 'Par année'}
                </button>
              ))}
            </div>

            {/* Formulaire selon le mode */}
            <div className="space-y-3 mb-5">
              {exportMode === 'plage' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Date début</label>
                    <input
                      type="date"
                      value={exportFrom}
                      onChange={(e) => setExportFrom(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Date fin</label>
                    <input
                      type="date"
                      value={exportTo}
                      min={exportFrom}
                      onChange={(e) => setExportTo(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

              {/* TICK-130/131 — 2 selects mois + année, uniquement dates disponibles */}
              {exportMode === 'mois' && (
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Mois</label>
                    <select
                      value={effectiveMoisMonth}
                      onChange={(e) => setExportMoisMonth(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      {availableMonthsForMoisYear.map((m) => (
                        <option key={m} value={String(m)}>{MOIS_NOMS[m]}</option>
                      ))}
                      {availableMonthsForMoisYear.length === 0 && (
                        <option value="">Aucun mois disponible</option>
                      )}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Année</label>
                    <select
                      value={effectiveMoisYear}
                      onChange={(e) => {
                        setExportMoisYear(e.target.value);
                        // reset mois si non disponible dans la nouvelle année
                        const months = availableMonthsByYear.get(parseInt(e.target.value)) ?? [];
                        if (!months.includes(parseInt(exportMoisMonth))) {
                          setExportMoisMonth(String(months[0] ?? 0));
                        }
                      }}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      {availableYears.map((y) => (
                        <option key={y} value={String(y)}>{y}</option>
                      ))}
                      {availableYears.length === 0 && (
                        <option value="">Aucune année disponible</option>
                      )}
                    </select>
                  </div>
                </div>
              )}

              {exportMode === 'annee' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Année</label>
                  <select
                    value={effectiveExportAnnee}
                    onChange={(e) => setExportAnnee(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {availableYears.map((y) => (
                      <option key={y} value={String(y)}>{y}</option>
                    ))}
                    {availableYears.length === 0 && (
                      <option value="">Aucune année disponible</option>
                    )}
                  </select>
                </div>
              )}
            </div>

            {/* Récapitulatif */}
            {availableYears.length > 0 && (
              <p className="text-xs text-gray-400 mb-4">
                {(() => {
                  const { from, to } = computeExportRange();
                  return `Période : ${new Date(from + 'T12:00:00').toLocaleDateString('fr-FR')} → ${new Date(to + 'T12:00:00').toLocaleDateString('fr-FR')}`;
                })()}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowExportModal(false)}
                className="flex-1 border border-gray-200 text-gray-700 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleExportCSV}
                disabled={exporting || availableYears.length === 0}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
              >
                {exporting ? '…' : 'Exporter CSV'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bannière reminder Stripe */}
      <OnboardingReminderBanner stripeConnected={stripeConnected} />

      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Commandes</h1>
          {fermeeAujourdhui && (
            <span className="bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              BOUTIQUE FERMÉE
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className={`w-2 h-2 rounded-full ${error ? 'bg-red-400' : 'bg-green-400'}`} />
          {lastSync
            ? `Mis à jour à ${lastSync.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
            : 'Synchronisation…'}
        </div>
      </div>

      {/* KPI cards du jour */}
      <KpiCards commandes={commandes} loading={loading} />

      {/* TICK-105 — Toggle boutique */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {fermeeAujourdhui ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleFermeture(false)}
              disabled={loadingFermeture}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              {loadingFermeture ? '…' : 'Rouvrir la boutique'}
            </button>
            <p className="text-xs text-gray-400 italic">Pensez à rouvrir demain matin.</p>
          </div>
        ) : (
          <button
            onClick={() => setShowConfirmFermer(true)}
            className="border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Fermer la boutique pour aujourd&apos;hui
          </button>
        )}
      </div>

      {/* TICK-124 — Onglets */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setOnglet('en_cours')}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            onglet === 'en_cours' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          En cours
          {nbEnCours > 0 && (
            <span className="ml-1.5 bg-blue-100 text-blue-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
              {nbEnCours}
            </span>
          )}
        </button>
        <button
          onClick={() => setOnglet('passees')}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            onglet === 'passees' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Passées
          {commandesPassees.length > 0 && (
            <span className="ml-1.5 bg-gray-100 text-gray-600 text-xs font-bold px-1.5 py-0.5 rounded-full">
              {commandesPassees.length}
            </span>
          )}
        </button>
      </div>

      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-gray-200 rounded-xl h-20 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && error && (
        <p className="text-red-500 text-center py-8">Impossible de charger les commandes. Vérifiez votre connexion.</p>
      )}

      {/* ── Onglet "En cours" ─────────────────────────────────────────────── */}
      {!loading && !error && onglet === 'en_cours' && (
        <div className="space-y-5">
          {/* Kanban */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-5">
            <div className="grid grid-cols-3 gap-4">
                {/* À préparer */}
                <div className="flex flex-col rounded-xl overflow-hidden border-2 border-blue-400">
                  <div className="bg-blue-100 px-4 py-3 border-b-2 border-blue-400 shrink-0">
                    <h2 className="text-sm font-bold text-blue-900 uppercase tracking-wider flex items-center gap-2">
                      À préparer
                      <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{commandesEnAttente.length}</span>
                    </h2>
                  </div>
                  <div className="min-h-[30vh] max-h-[55vh] overflow-y-auto p-3 space-y-3 bg-blue-50/40">
                    {commandesEnAttente.map((c) => <OrderCard key={c._id} commande={c} onAdvance={advanceStatut} />)}
                    {commandesEnAttente.length === 0 && <p className="text-xs text-blue-400 italic text-center mt-4">Aucune.</p>}
                  </div>
                </div>

                {/* En préparation */}
                <div className="flex flex-col rounded-xl overflow-hidden border-2 border-amber-500">
                  <div className="bg-amber-100 px-4 py-3 border-b-2 border-amber-500 shrink-0">
                    <h2 className="text-sm font-bold text-amber-900 uppercase tracking-wider flex items-center gap-2">
                      En préparation
                      <span className="bg-amber-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{commandesEnPreparation.length}</span>
                    </h2>
                  </div>
                  <div className="min-h-[30vh] max-h-[55vh] overflow-y-auto p-3 space-y-3 bg-amber-50/40">
                    {commandesEnPreparation.map((c) => <OrderCard key={c._id} commande={c} onAdvance={advanceStatut} />)}
                    {commandesEnPreparation.length === 0 && <p className="text-xs italic text-center mt-4" style={{ color: 'rgb(169, 122, 0)' }}>Aucune.</p>}
                  </div>
                </div>

                {/* Prêtes */}
                <div className="flex flex-col rounded-xl overflow-hidden border-2 border-green-500">
                  <div className="bg-green-100 px-4 py-3 border-b-2 border-green-500 shrink-0">
                    <h2 className="text-sm font-bold text-green-900 uppercase tracking-wider flex items-center gap-2">
                      Prêtes
                      <span className="bg-green-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{commandesPrêtes.length}</span>
                    </h2>
                  </div>
                  <div className="min-h-[30vh] max-h-[55vh] overflow-y-auto p-3 space-y-3 bg-green-50/40">
                    {commandesPrêtes.map((c) => <OrderCard key={c._id} commande={c} onAdvance={advanceStatut} />)}
                    {commandesPrêtes.length === 0 && <p className="text-xs text-green-400 italic text-center mt-4">Aucune.</p>}
                  </div>
                </div>
              </div>
          </div>

          {/* Récupérées aujourd'hui — TICK-104, TICK-121 */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-5">
          <section className="flex flex-col overflow-hidden" style={{ height: '35vh' }}>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 shrink-0">
              Récupérées aujourd&apos;hui ({commandesRecupereesAujourdHui.length})
            </h2>
            {commandesRecupereesAujourdHui.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Aucune commande récupérée aujourd&apos;hui.</p>
            ) : (
              <div className="overflow-auto rounded-xl bg-white shadow-md flex-1">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="sticky top-0 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      <th className="px-4 py-3 text-left">#</th>
                      <th className="px-4 py-3 text-left">Heure</th>
                      <th className="px-4 py-3 text-left">Client</th>
                      <th className="px-4 py-3 text-left">Téléphone</th>
                      <th className="px-4 py-3 text-left">Retrait</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {commandesRecupereesAujourdHui.map((c) => {
                      const isOpen = expandedRecupId === c._id;
                      return (
                        <React.Fragment key={c._id}>
                          <tr
                            onClick={() => setExpandedRecupId(isOpen ? null : c._id)}
                            className={`odd:bg-white even:bg-gray-50 hover:bg-blue-50 transition-colors cursor-pointer ${isOpen ? '' : 'border-b border-gray-100'}`}
                          >
                            <td className="px-4 py-3 font-mono text-xs text-gray-400">
                              #{c._id.slice(-6).toUpperCase()}
                            </td>
                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                              {new Date(c.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-900">{c.client.nom}</td>
                            <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{c.client.telephone}</td>
                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                              {c.retrait.type === 'immediat' ? 'Dès que possible' : `À ${c.retrait.creneau}`}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                              {(c.total / 100).toFixed(2).replace('.', ',') + ' €'}
                            </td>
                            <td className="px-4 py-3 text-gray-400 text-xs">{isOpen ? '▲' : '▼'}</td>
                          </tr>
                          <tr className="border-b border-gray-100 odd:bg-white even:bg-gray-50">
                            <td colSpan={7} className="px-4 pb-0 pt-0 overflow-hidden">
                              <AnimatePresence initial={false}>
                                {isOpen && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.22, ease: 'easeInOut' }}
                                    className="overflow-hidden"
                                  >
                                    <div className="border-t border-dashed border-gray-200 py-2.5 space-y-1.5">
                                      {c.produits.map((p, idx) => (
                                        <div key={idx} className="flex justify-between text-xs text-gray-600">
                                          <span>
                                            {p.quantite}× {p.nom}
                                            {p.options.length > 0 && (
                                              <span className="text-gray-400"> ({p.options.map((o) => o.nom).join(', ')})</span>
                                            )}
                                          </span>
                                          <span className="text-gray-500">
                                            {((p.prix + p.options.reduce((s, o) => s + o.prix, 0)) * p.quantite / 100).toFixed(2).replace('.', ',') + ' €'}
                                          </span>
                                        </div>
                                      ))}
                                      {c.commentaire && (
                                        <p className="text-xs text-gray-400 italic mt-1">Note : {c.commentaire}</p>
                                      )}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          </div>
        </div>
      )}

      {/* ── Onglet "Passées" ──────────────────────────────────────────────── */}
      {!loading && !error && onglet === 'passees' && (
        <>
          <div className="flex justify-between items-center mb-6">
            <p className="text-sm text-gray-500">
              {commandesPassees.length} commande{commandesPassees.length !== 1 ? 's' : ''} terminée{commandesPassees.length !== 1 ? 's' : ''}
            </p>
            <button
              onClick={() => setShowExportModal(true)}
              disabled={commandesPassees.length === 0}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              Exporter CSV
            </button>
          </div>

          {commandesPassees.length === 0 ? (
            <p className="text-gray-400 text-center py-16">Aucune commande passée.</p>
          ) : (
            /* TICK-126 + TICK-128 — Timeline verticale rétractable */
            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-200" />

              <div className="space-y-0">
                {timelineGroups.map((group) => {
                  const yearCollapsed = collapsedYears.has(group.year);
                  const monthCollapsed = collapsedMonths.has(group.monthKey);
                  const dayCollapsed = collapsedDays.has(group.key);

                  return (
                    <div key={group.key}>
                      {/* ── Séparateur Année ── */}
                      {group.showYear && (
                        <button
                          onClick={() => toggleYear(group.year)}
                          className="relative z-10 flex items-center gap-2 mb-3 mt-6 first:mt-0 w-full text-left group"
                        >
                          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-800 text-white text-xs font-bold shadow">
                            {yearCollapsed ? '▶' : '▼'}
                          </div>
                          <span className="text-sm font-bold text-gray-800 uppercase tracking-widest group-hover:text-gray-600 transition-colors">
                            {group.year}
                          </span>
                        </button>
                      )}

                      {!yearCollapsed && (
                        <>
                          {/* ── Séparateur Mois ── */}
                          {group.showMonth && (
                            <button
                              onClick={() => toggleMonth(group.monthKey)}
                              className="relative z-10 flex items-center gap-2 mb-3 mt-4 w-full text-left group"
                            >
                              <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gray-400 text-white text-[9px] font-bold shadow ring-2 ring-white">
                                {monthCollapsed ? '▶' : '▼'}
                              </div>
                              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider capitalize group-hover:text-gray-700 transition-colors">
                                {group.monthLabel}
                              </span>
                            </button>
                          )}

                          {/* ── Entrée Jour ── */}
                          {!monthCollapsed && (
                            <div className="relative flex gap-4 pb-5 pl-0">
                              {/* Nœud jour */}
                              <div className="relative z-10 mt-1 flex-shrink-0">
                                <div className="h-3 w-3 rounded-full bg-blue-400 border-2 border-white shadow ml-1.5" />
                              </div>

                              <div className="flex-1 min-w-0">
                                {/* TICK-128 — Header jour rétractable */}
                                <button
                                  onClick={() => toggleDay(group.key)}
                                  className="flex items-center gap-2 px-2 py-1 mb-2 w-full text-left rounded-md hover:bg-gray-100 active:bg-gray-200 transition-colors group"
                                >
                                  <span className="text-xs font-semibold text-gray-700 capitalize">
                                    {group.dayLabel}
                                  </span>
                                  {/* TICK-129 — Contraste amélioré */}
                                  <span className="text-xs text-gray-500">
                                    · {group.commandes.length} commande{group.commandes.length !== 1 ? 's' : ''}
                                    {' '}<span className="text-blue-600 font-semibold">· {(group.commandes.reduce((sum, c) => sum + c.total, 0) / 100).toFixed(2).replace('.', ',')} €</span>
                                  </span>
                                  <span className="ml-auto text-gray-400 text-[10px] group-hover:text-gray-600 transition-colors">
                                    {dayCollapsed ? '▶' : '▼'}
                                  </span>
                                </button>

                                {!dayCollapsed && (
                                  <div className="space-y-3">
                                    {group.commandes.map((c) => (
                                      <CommandeRow key={c._id} commande={c} onAdvance={advanceStatut} />
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

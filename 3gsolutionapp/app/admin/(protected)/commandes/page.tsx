'use client';

// TICK-104 — Section "Récupérées aujourd'hui" + transitions complètes (payee → en_preparation → prete → recuperee)
// TICK-105 — Toggle fermeture boutique
// TICK-106 — Export CSV

import { useEffect, useState, useCallback } from 'react';
import CommandeRow, { CommandeData, StatutCommande } from '@/components/admin/CommandeRow';

const POLL_INTERVAL_MS = 10_000;

type PeriodeExport = 'aujourd_hui' | 'semaine' | 'mois';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getPeriode(periode: PeriodeExport): { from: string; to: string } {
  const today = new Date();
  const to = toDateStr(today);
  if (periode === 'aujourd_hui') return { from: to, to };
  if (periode === 'semaine') {
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
    return { from: toDateStr(monday), to };
  }
  // mois
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  return { from: toDateStr(first), to };
}

export default function AdminCommandesPage() {
  const [commandes, setCommandes] = useState<CommandeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [error, setError] = useState(false);

  // TICK-105 — Fermeture boutique
  const [fermeeAujourdhui, setFermeeAujourdhui] = useState(false);
  const [loadingFermeture, setLoadingFermeture] = useState(false);
  const [showConfirmFermer, setShowConfirmFermer] = useState(false);

  // TICK-106 — Export CSV
  const [periodeExport, setPeriodeExport] = useState<PeriodeExport>('aujourd_hui');
  const [exporting, setExporting] = useState(false);

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

  // Charger SiteConfig pour fermeeAujourdhui — TICK-105
  useEffect(() => {
    fetch('/api/site-config')
      .then((r) => r.json())
      .then(({ data }) => {
        setFermeeAujourdhui(data?.fermeeAujourdhui ?? false);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchCommandes();
  }, [fetchCommandes]);

  useEffect(() => {
    const interval = setInterval(fetchCommandes, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchCommandes]);

  // ── Avancer statut (toutes transitions) — TICK-099, TICK-104 ─────────────

  const advanceStatut = async (id: string, statut: StatutCommande) => {
    await fetch(`/api/commandes/${id}/statut`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut }),
    });
    setCommandes((prev) =>
      prev.map((c) => (c._id === id ? { ...c, statut } : c))
    );
  };

  // ── Anonymisation RGPD — TICK-057 ────────────────────────────────────────

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
      if (res.ok) {
        setFermeeAujourdhui(fermer);
      }
    } catch {
      // silencieux
    } finally {
      setLoadingFermeture(false);
      setShowConfirmFermer(false);
    }
  };

  // ── Export CSV — TICK-106 ─────────────────────────────────────────────────

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const { from, to } = getPeriode(periodeExport);
      const res = await fetch(`/api/admin/commandes/export?from=${from}&to=${to}`);
      if (!res.ok) throw new Error('Erreur export');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `commandes-${from}-${to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Erreur lors de l\'export CSV.');
    } finally {
      setExporting(false);
    }
  };

  // ── Filtres ───────────────────────────────────────────────────────────────

  const today = startOfToday();

  const commandesEnAttente = commandes.filter((c) => c.statut === 'payee');
  const commandesEnPreparation = commandes.filter((c) => c.statut === 'en_preparation');
  const commandesPrêtes = commandes.filter((c) => c.statut === 'prete');
  const commandesRecuperees = commandes.filter(
    (c) => c.statut === 'recuperee' && new Date(c.createdAt) >= today
  );

  return (
    <div>
      {/* Modale confirmation fermeture */}
      {showConfirmFermer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Confirmer la fermeture ?</h3>
            <p className="text-sm text-gray-500 mb-5">
              Aucune nouvelle commande ne sera acceptée.
            </p>
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

      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Commandes</h1>
          {/* Badge boutique fermée — TICK-105 */}
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

      {/* Barre d'actions — fermeture + export */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* TICK-105 — Toggle boutique */}
        {fermeeAujourdhui ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleFermeture(false)}
              disabled={loadingFermeture}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              {loadingFermeture ? '…' : 'Rouvrir la boutique'}
            </button>
            <p className="text-xs text-gray-400 italic">
              Ce champ se réinitialise manuellement — pensez à rouvrir demain matin.
            </p>
          </div>
        ) : (
          <button
            onClick={() => setShowConfirmFermer(true)}
            className="border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Fermer la boutique pour aujourd&apos;hui
          </button>
        )}

        {/* TICK-106 — Export CSV */}
        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
            {(['aujourd_hui', 'semaine', 'mois'] as PeriodeExport[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriodeExport(p)}
                className={`px-3 py-1.5 transition-colors ${
                  periodeExport === p
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {p === 'aujourd_hui' ? "Aujourd'hui" : p === 'semaine' ? 'Semaine' : 'Mois'}
              </button>
            ))}
          </div>
          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            {exporting ? '…' : 'Exporter CSV'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-gray-200 rounded-xl h-20 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && error && (
        <p className="text-red-500 text-center py-8">
          Impossible de charger les commandes. Vérifiez votre connexion.
        </p>
      )}

      {!loading && !error && commandes.filter(c => ['payee','en_preparation','prete'].includes(c.statut)).length === 0 && (
        <p className="text-gray-400 text-center py-16">
          Aucune commande en cours.
        </p>
      )}

      {/* Commandes en cours — 3 colonnes */}
      {!loading && !error && (
        <div className="grid grid-cols-3 gap-6 items-start mb-8">
          {/* À préparer */}
          <section>
            <h2 className="text-sm font-semibold text-blue-700 uppercase tracking-wider mb-3">
              À préparer ({commandesEnAttente.length})
            </h2>
            <div className="space-y-3">
              {commandesEnAttente.map((c) => (
                <CommandeRow key={c._id} commande={c} onAdvance={advanceStatut} onSupprimer={handleSupprimer} />
              ))}
              {commandesEnAttente.length === 0 && (
                <p className="text-xs text-gray-400 italic">Aucune.</p>
              )}
            </div>
          </section>

          {/* En préparation */}
          <section>
            <h2 className="text-sm font-semibold text-amber-700 uppercase tracking-wider mb-3">
              En préparation ({commandesEnPreparation.length})
            </h2>
            <div className="space-y-3">
              {commandesEnPreparation.map((c) => (
                <CommandeRow key={c._id} commande={c} onAdvance={advanceStatut} onSupprimer={handleSupprimer} />
              ))}
              {commandesEnPreparation.length === 0 && (
                <p className="text-xs text-gray-400 italic">Aucune.</p>
              )}
            </div>
          </section>

          {/* Prêtes */}
          <section>
            <h2 className="text-sm font-semibold text-green-700 uppercase tracking-wider mb-3">
              Prêtes ({commandesPrêtes.length})
            </h2>
            <div className="space-y-3">
              {commandesPrêtes.map((c) => (
                <CommandeRow key={c._id} commande={c} onAdvance={advanceStatut} onSupprimer={handleSupprimer} />
              ))}
              {commandesPrêtes.length === 0 && (
                <p className="text-xs text-gray-400 italic">Aucune.</p>
              )}
            </div>
          </section>
        </div>
      )}

      {/* Section récupérées aujourd'hui — TICK-104 */}
      {!loading && !error && (
        <section className="border-t pt-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Récupérées aujourd&apos;hui ({commandesRecuperees.length})
          </h2>
          {commandesRecuperees.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Aucune commande récupérée aujourd&apos;hui.</p>
          ) : (
            <div className="space-y-3">
              {commandesRecuperees.map((c) => (
                <CommandeRow key={c._id} commande={c} onAdvance={advanceStatut} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

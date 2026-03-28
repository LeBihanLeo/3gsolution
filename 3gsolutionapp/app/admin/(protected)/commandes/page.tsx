'use client';

// TICK-104 — Section "Récupérées aujourd'hui" + transitions complètes (payee → en_preparation → prete → recuperee)
// TICK-105 — Toggle fermeture boutique
// TICK-106 — Export CSV
// TICK-121 — Fix filtre "Récupérées aujourd'hui" avec heure locale Paris
// TICK-124 — 2 onglets "En cours" / "Passées"
// TICK-125 — Export CSV dans l'onglet "Passées", filtré statut=recuperee

import { useEffect, useState, useCallback } from 'react';
import CommandeRow, { CommandeData, StatutCommande } from '@/components/admin/CommandeRow';

const POLL_INTERVAL_MS = 10_000;

type Onglet = 'en_cours' | 'passees';

// TICK-121 — Minuit local Europe/Paris pour comparaison createdAt
function startOfTodayParis(): Date {
  const now = new Date();
  const parisStr = now.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });
  const [day, month, year] = parisStr.split('/').map(Number);
  return new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00`);
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
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

  // TICK-125 — Export CSV commandes passées
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
    fetch('/api/site-config', { cache: 'no-store' })
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
    // TICK-124 — conserver l'onglet actif après changement de statut
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

  // ── Export CSV commandes passées — TICK-125 ───────────────────────────────

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const today = toDateStr(new Date());
      const firstOfMonth = toDateStr(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
      const res = await fetch(
        `/api/admin/commandes/export?statut=recuperee&from=${firstOfMonth}&to=${today}`
      );
      if (!res.ok) throw new Error('Erreur export');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `commandes-passees-${today}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Erreur lors de l'export CSV.");
    } finally {
      setExporting(false);
    }
  };

  // ── Filtres ───────────────────────────────────────────────────────────────

  const today = startOfTodayParis();

  const commandesEnAttente = commandes.filter((c) => c.statut === 'payee');
  const commandesEnPreparation = commandes.filter((c) => c.statut === 'en_preparation');
  const commandesPrêtes = commandes.filter((c) => c.statut === 'prete');

  // TICK-121 — filtre robuste : isNaN guard + comparaison heure locale Paris
  const commandesRecupereesAujourdHui = commandes.filter((c) => {
    if (c.statut !== 'recuperee') return false;
    const d = new Date(c.createdAt);
    return !isNaN(d.getTime()) && d >= today;
  });

  // TICK-124 — Toutes les recuperee pour l'onglet "Passées"
  const commandesPassees = commandes
    .filter((c) => c.statut === 'recuperee')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const nbEnCours =
    commandesEnAttente.length + commandesEnPreparation.length + commandesPrêtes.length;

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
            <p className="text-xs text-gray-400 italic">
              Pensez à rouvrir demain matin.
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
      </div>

      {/* TICK-124 — Onglets En cours / Passées */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setOnglet('en_cours')}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            onglet === 'en_cours'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
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
            onglet === 'passees'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
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
        <p className="text-red-500 text-center py-8">
          Impossible de charger les commandes. Vérifiez votre connexion.
        </p>
      )}

      {/* ── Onglet "En cours" ─────────────────────────────────────────────── */}
      {!loading && !error && onglet === 'en_cours' && (
        <>
          {nbEnCours === 0 && (
            <p className="text-gray-400 text-center py-16">Aucune commande en cours.</p>
          )}

          {/* 3 colonnes kanban */}
          <div className="grid grid-cols-3 gap-6 items-start mb-8">
            <section>
              <h2 className="text-sm font-semibold text-blue-700 uppercase tracking-wider mb-3">
                À préparer ({commandesEnAttente.length})
              </h2>
              <div className="space-y-3">
                {commandesEnAttente.map((c) => (
                  <CommandeRow key={c._id} commande={c} onAdvance={advanceStatut} />
                ))}
                {commandesEnAttente.length === 0 && (
                  <p className="text-xs text-gray-400 italic">Aucune.</p>
                )}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-amber-700 uppercase tracking-wider mb-3">
                En préparation ({commandesEnPreparation.length})
              </h2>
              <div className="space-y-3">
                {commandesEnPreparation.map((c) => (
                  <CommandeRow key={c._id} commande={c} onAdvance={advanceStatut} />
                ))}
                {commandesEnPreparation.length === 0 && (
                  <p className="text-xs text-gray-400 italic">Aucune.</p>
                )}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-green-700 uppercase tracking-wider mb-3">
                Prêtes ({commandesPrêtes.length})
              </h2>
              <div className="space-y-3">
                {commandesPrêtes.map((c) => (
                  <CommandeRow key={c._id} commande={c} onAdvance={advanceStatut} />
                ))}
                {commandesPrêtes.length === 0 && (
                  <p className="text-xs text-gray-400 italic">Aucune.</p>
                )}
              </div>
            </section>
          </div>

          {/* Section récupérées aujourd'hui — TICK-104, TICK-121 */}
          <section className="border-t pt-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Récupérées aujourd&apos;hui ({commandesRecupereesAujourdHui.length})
            </h2>
            {commandesRecupereesAujourdHui.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Aucune commande récupérée aujourd&apos;hui.</p>
            ) : (
              <div className="space-y-3">
                {commandesRecupereesAujourdHui.map((c) => (
                  <CommandeRow key={c._id} commande={c} onAdvance={advanceStatut} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* ── Onglet "Passées" ──────────────────────────────────────────────── */}
      {!loading && !error && onglet === 'passees' && (
        <>
          {/* TICK-125 — Export CSV */}
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-500">
              {commandesPassees.length} commande{commandesPassees.length > 1 ? 's' : ''} récupérée{commandesPassees.length > 1 ? 's' : ''}
            </p>
            <button
              onClick={handleExportCSV}
              disabled={exporting || commandesPassees.length === 0}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              {exporting ? '…' : 'Exporter CSV'}
            </button>
          </div>

          {commandesPassees.length === 0 ? (
            <p className="text-gray-400 text-center py-16">Aucune commande passée.</p>
          ) : (
            <div className="space-y-3">
              {commandesPassees.map((c) => (
                <CommandeRow key={c._id} commande={c} onAdvance={advanceStatut} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

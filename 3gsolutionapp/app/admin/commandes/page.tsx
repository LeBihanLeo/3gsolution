'use client';

import { useEffect, useState, useCallback } from 'react';
import CommandeRow, { CommandeData } from '@/components/admin/CommandeRow';

const POLL_INTERVAL_MS = 10_000;

export default function AdminCommandesPage() {
  const [commandes, setCommandes] = useState<CommandeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [error, setError] = useState(false);

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

  // Chargement initial
  useEffect(() => {
    fetchCommandes();
  }, [fetchCommandes]);

  // Polling toutes les 10 secondes
  useEffect(() => {
    const interval = setInterval(fetchCommandes, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchCommandes]);

  const marquerPrete = async (id: string) => {
    await fetch(`/api/commandes/${id}/statut`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: 'prete' }),
    });
    // Mise à jour locale immédiate sans attendre le polling
    setCommandes((prev) =>
      prev.map((c) => (c._id === id ? { ...c, statut: 'prete' as const } : c))
    );
  };

  const commandesPayees = commandes.filter((c) => c.statut === 'payee');
  const commandesPrêtes = commandes.filter((c) => c.statut === 'prete');

  return (
    <div>
      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Commandes</h1>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span
            className={`w-2 h-2 rounded-full ${error ? 'bg-red-400' : 'bg-green-400'}`}
          />
          {lastSync
            ? `Mis à jour à ${lastSync.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
            : 'Synchronisation…'}
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

      {!loading && !error && commandes.length === 0 && (
        <p className="text-gray-400 text-center py-16">
          Aucune commande pour le moment.
        </p>
      )}

      {/* Commandes en attente de préparation */}
      {commandesPayees.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-blue-700 uppercase tracking-wider mb-3">
            À préparer ({commandesPayees.length})
          </h2>
          <div className="space-y-3">
            {commandesPayees.map((c) => (
              <CommandeRow key={c._id} commande={c} onMarquerPrete={marquerPrete} />
            ))}
          </div>
        </section>
      )}

      {/* Commandes prêtes */}
      {commandesPrêtes.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-green-700 uppercase tracking-wider mb-3">
            Prêtes ({commandesPrêtes.length})
          </h2>
          <div className="space-y-3">
            {commandesPrêtes.map((c) => (
              <CommandeRow key={c._id} commande={c} onMarquerPrete={marquerPrete} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

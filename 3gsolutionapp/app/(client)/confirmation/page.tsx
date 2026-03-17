'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '@/lib/cartContext';

// ─── Types ───────────────────────────────────────────────────────────────────

type StatutCommande = 'payee' | 'prete';

interface SuiviReponse {
  statut: StatutCommande;
  retrait: { type: 'immediat' | 'creneau'; creneau?: string };
  produits: { nom: string; quantite: number }[];
  total: number;
  createdAt: string;
}

const POLL_INTERVAL_MS = 15_000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPrix(centimes: number): string {
  return (centimes / 100).toFixed(2).replace('.', ',') + ' €';
}

function tempsDepuis(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return `il y a ${secs} s`;
  return `il y a ${Math.floor(secs / 60)} min`;
}

// ─── Composant principal ─────────────────────────────────────────────────────

function SuiviContent() {
  const params = useSearchParams();
  const sessionId = params.get('session_id');
  const { clearCart } = useCart();

  const [data, setData] = useState<SuiviReponse | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [derniereMaj, setDerniereMaj] = useState<Date | null>(null);
  const [tick, setTick] = useState(0); // force re-render pour "il y a X s"

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchSuivi() {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/commandes/suivi?session_id=${encodeURIComponent(sessionId)}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setErreur(json.error ?? 'Commande introuvable ou paiement non confirmé.');
        setChargement(false);
        return;
      }
      const json: SuiviReponse = await res.json();
      setData(json);
      setErreur(null);
      setDerniereMaj(new Date());

      // Arrêter le polling quand la commande est prête
      if (json.statut === 'prete' && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    } catch {
      // Erreur réseau silencieuse : on conserve les données précédentes
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    if (!sessionId) {
      setChargement(false);
      return;
    }

    // Vider le panier dès l'arrivée sur cette page
    clearCart();

    // Appel initial immédiat
    fetchSuivi();

    // Polling toutes les 15 secondes
    intervalRef.current = setInterval(fetchSuivi, POLL_INTERVAL_MS);

    // Tick toutes les secondes pour rafraîchir "il y a X s"
    const tickInterval = setInterval(() => setTick((t) => t + 1), 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      clearInterval(tickInterval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // ─── Pas de session_id ──────────────────────────────────────────────────
  if (!sessionId) {
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-4">❌</p>
        <p className="text-red-500 text-lg font-medium mb-2">Lien invalide ou expiré</p>
        <p className="text-gray-500 text-sm mb-6">Aucun identifiant de commande trouvé.</p>
        <Link href="/" className="text-blue-600 hover:underline text-sm">
          ← Retour au menu
        </Link>
      </div>
    );
  }

  // ─── Chargement initial ─────────────────────────────────────────────────
  if (chargement) {
    return (
      <div className="text-center py-16 text-gray-400 animate-pulse">
        Chargement de votre commande…
      </div>
    );
  }

  // ─── Erreur ─────────────────────────────────────────────────────────────
  if (erreur) {
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-4">⚠️</p>
        <p className="text-red-500 font-medium mb-2">{erreur}</p>
        <p className="text-gray-400 text-sm mb-6">
          Si vous venez de payer, votre commande sera disponible dans quelques instants.
        </p>
        <Link href="/" className="text-blue-600 hover:underline text-sm">
          ← Retour au menu
        </Link>
      </div>
    );
  }

  // ─── Données disponibles ────────────────────────────────────────────────
  const estPrete = data?.statut === 'prete';

  return (
    <div className="max-w-md mx-auto py-8 space-y-6">

      {/* Bandeau statut */}
      {estPrete ? (
        <div className="rounded-2xl bg-green-50 border border-green-200 p-6 text-center">
          <div className="text-5xl mb-3">✅</div>
          <h1 className="text-xl font-bold text-green-800 mb-1">
            Commande prête !
          </h1>
          <p className="text-green-700 text-sm">Venez la récupérer.</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-6 text-center">
          <div className="flex justify-center mb-3">
            <span className="inline-block w-10 h-10 rounded-full bg-amber-400 animate-pulse" />
          </div>
          <h1 className="text-xl font-bold text-amber-800 mb-1">
            En cours de préparation…
          </h1>
          <p className="text-amber-700 text-sm">
            Nous vous préviendrons dès que votre commande est prête.
          </p>
        </div>
      )}

      {/* Créneau de retrait */}
      {data?.retrait && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Retrait</p>
          {data.retrait.type === 'immediat' ? (
            <p className="font-semibold text-gray-800">Dès que possible</p>
          ) : (
            <p className="font-bold text-gray-900 text-lg">{data.retrait.creneau}</p>
          )}
        </div>
      )}

      {/* Récapitulatif produits */}
      {data && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Récapitulatif</p>
          <ul className="space-y-1">
            {data.produits.map((p, i) => (
              <li key={i} className="flex justify-between text-sm text-gray-700">
                <span>{p.quantite}× {p.nom}</span>
              </li>
            ))}
          </ul>
          <div className="border-t mt-3 pt-3 flex justify-between font-bold text-gray-900">
            <span>Total</span>
            <span>{formatPrix(data.total)}</span>
          </div>
        </div>
      )}

      {/* Indicateur mise à jour */}
      {!estPrete && derniereMaj && (
        <p className="text-center text-xs text-gray-400">
          {/* tick utilisé pour forcer le re-render */}
          {tick >= 0 && `Dernière mise à jour : ${tempsDepuis(derniereMaj)}`}
        </p>
      )}

      {/* Bouton retour */}
      <div className="text-center">
        <Link
          href="/"
          className="inline-block text-blue-600 hover:underline text-sm"
        >
          ← Retour au menu
        </Link>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConfirmationPage() {
  return (
    <Suspense fallback={<div className="text-center py-16 text-gray-400">Chargement…</div>}>
      <SuiviContent />
    </Suspense>
  );
}

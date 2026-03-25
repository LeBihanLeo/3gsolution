'use client';
// TICK-086 — Fix : page confirmation publique + polling robuste (max 10 tentatives × 2s)

import { useEffect, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '@/lib/cartContext';

// ─── Types ───────────────────────────────────────────────────────────────────

type StatutCommande = 'payee' | 'prete';

interface SuiviReponse {
  commandeId: string;
  statut: StatutCommande;
  retrait: { type: 'immediat' | 'creneau'; creneau?: string };
  produits: { nom: string; quantite: number }[];
  total: number;
  createdAt: string;
}

function idCourt(id: string): string {
  return id.slice(-6).toUpperCase();
}

// Polling rapide (2s) pour les premières tentatives après paiement
const POLL_INITIAL_MS = 2_000;
// Polling lent (15s) une fois la commande trouvée
const POLL_SLOW_MS = 15_000;
// Nombre de tentatives rapides avant de passer en polling lent ou abandonner
const MAX_INITIAL_ATTEMPTS = 10;

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
  // null = chargement, false = en attente webhook, 'erreur' = erreur définitive
  const [etat, setEtat] = useState<'loading' | 'attente-webhook' | 'erreur' | 'ok'>('loading');
  const [derniereMaj, setDerniereMaj] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tentativesRef = useRef(0);

  function stopPolling() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  async function fetchSuivi() {
    if (!sessionId) return;

    tentativesRef.current += 1;

    try {
      const res = await fetch(`/api/commandes/suivi?session_id=${encodeURIComponent(sessionId)}`);

      if (!res.ok) {
        // Commande pas encore créée (webhook en attente)
        if (tentativesRef.current < MAX_INITIAL_ATTEMPTS) {
          setEtat('attente-webhook');
          return; // continuer le polling
        }
        // Dépassé les tentatives → message d'information (pas d'erreur rouge)
        setEtat('erreur');
        stopPolling();
        return;
      }

      const json: SuiviReponse = await res.json();
      setData(json);
      setEtat('ok');
      setDerniereMaj(new Date());

      // Arrêter le polling rapide, passer en polling lent si pas encore prête
      stopPolling();
      if (json.statut !== 'prete') {
        intervalRef.current = setInterval(fetchSuivi, POLL_SLOW_MS);
      }
    } catch {
      // Erreur réseau silencieuse : conserver l'état précédent
    }
  }

  useEffect(() => {
    if (!sessionId) {
      setEtat('erreur');
      return;
    }

    clearCart();
    fetchSuivi();

    // Polling initial rapide (toutes les 2s) pour attendre le webhook Stripe
    intervalRef.current = setInterval(fetchSuivi, POLL_INITIAL_MS);

    const tickInterval = setInterval(() => setTick((t) => t + 1), 1000);

    return () => {
      stopPolling();
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
        <Link href="/" className="text-blue-600 hover:underline text-sm">← Retour au menu</Link>
      </div>
    );
  }

  // ─── Attente webhook (premières tentatives) ──────────────────────────────
  if (etat === 'loading' || etat === 'attente-webhook') {
    return (
      <div className="text-center py-16 space-y-4">
        <div className="flex justify-center">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
        <p className="text-gray-600 font-medium">Votre commande est en cours de validation…</p>
        <p className="text-gray-400 text-sm">Veuillez patienter quelques instants.</p>
      </div>
    );
  }

  // ─── Dépassement du délai ────────────────────────────────────────────────
  if (etat === 'erreur') {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-4xl">⏳</p>
        <p className="text-gray-800 font-medium">Votre paiement a été reçu.</p>
        <p className="text-gray-500 text-sm">
          Votre commande sera disponible dans quelques instants. Contactez le restaurant si
          le problème persiste.
        </p>
        <Link href="/" className="text-blue-600 hover:underline text-sm">← Retour au menu</Link>
      </div>
    );
  }

  // ─── Données disponibles ────────────────────────────────────────────────
  const estPrete = data?.statut === 'prete';

  return (
    <div className="max-w-md mx-auto py-8 space-y-6">

      {estPrete ? (
        <div className="rounded-2xl bg-green-50 border border-green-200 p-6 text-center">
          <div className="text-5xl mb-3">✅</div>
          <h1 className="text-xl font-bold text-green-800 mb-1">Commande prête !</h1>
          <p className="text-green-700 text-sm">Venez la récupérer.</p>
          {data?.commandeId && (
            <p className="mt-3 font-mono text-xs text-green-600 bg-green-100 rounded px-3 py-1 inline-block">
              #{idCourt(data.commandeId)}
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-6 text-center">
          <div className="flex justify-center mb-3">
            <span className="inline-block w-10 h-10 rounded-full bg-amber-400 animate-pulse" />
          </div>
          <h1 className="text-xl font-bold text-amber-800 mb-1">En cours de préparation…</h1>
          <p className="text-amber-700 text-sm">
            Nous vous préviendrons dès que votre commande est prête.
          </p>
          {data?.commandeId && (
            <p className="mt-3 font-mono text-xs text-amber-600 bg-amber-100 rounded px-3 py-1 inline-block">
              #{idCourt(data.commandeId)}
            </p>
          )}
        </div>
      )}

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

      {!estPrete && derniereMaj && (
        <p className="text-center text-xs text-gray-400">
          {tick >= 0 && `Dernière mise à jour : ${tempsDepuis(derniereMaj)}`}
        </p>
      )}

      <div className="text-center">
        <Link href="/" className="inline-block text-blue-600 hover:underline text-sm">
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

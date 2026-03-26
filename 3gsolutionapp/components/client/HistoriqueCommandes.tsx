'use client';
// TICK-077 — Composant HistoriqueCommandes
// TICK-080 — Re-commande rapide
// TICK-094 — Fix comparaison IDs (toString())
// TICK-097 — Modale de suivi CommandeSuiviModal
// TICK-098 — Max 3 commandes passées + lien historique complet
// TICK-099 — Nouveaux statuts en_preparation / recuperee + CommandeStepper
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import CommandeSuiviModal from './CommandeSuiviModal';
import { StatutBadge } from './StatutBadge';
import { CommandeStatusCard } from './CommandeStatusCard';

interface ProduitSnapshot {
  produitId: string;
  nom: string;
  quantite: number;
  prix: number;
  options: { nom: string; prix: number }[];
}

interface CommandeHistorique {
  _id: string;
  statut: 'en_attente_paiement' | 'payee' | 'en_preparation' | 'prete' | 'recuperee';
  produits: ProduitSnapshot[];
  total: number;
  retrait: { type: 'immediat' | 'creneau'; creneau?: string };
  createdAt: string;
}

interface HistoriqueData {
  enCours: CommandeHistorique[];
  passees: CommandeHistorique[];
}

interface ProduitActif {
  _id: string;
  nom: string;
  prix: number;
  options: { nom: string; prix: number }[];
  imageUrl?: string;
  actif: boolean;
}

function idCourt(id: string) {
  return id.slice(-6).toUpperCase();
}

function formatPrix(centimes: number) {
  return (centimes / 100).toFixed(2).replace('.', ',') + ' €';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function CommandeCard({
  commande,
  variant,
  reorderLoading,
  onReorder,
  onSuivi,
}: {
  commande: CommandeHistorique;
  variant: 'en-cours' | 'passee';
  reorderLoading?: boolean;
  onReorder?: () => void;
  onSuivi?: () => void;
}) {

  const cardCls = variant === 'en-cours'
    ? 'rounded-2xl p-4 space-y-3 shadow-sm'
    : 'bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3';

  return (
    <div className={cardCls}>
      {/* Statut — card partagée sur les commandes en cours, en-tête simple sur les passées */}
      {variant === 'en-cours' ? (
        <CommandeStatusCard
          statut={commande.statut}
          commandeId={commande._id}
          produits={commande.produits}
        />
      ) : (
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs font-bold text-muted">
            #{idCourt(commande._id)}
          </span>
          <StatutBadge statut={commande.statut} size="sm" />
        </div>
      )}

      {/* Créneau */}
      <p className="text-sm text-gray-600">
        Retrait :{' '}
        {commande.retrait.type === 'immediat'
          ? 'Dès que possible'
          : commande.retrait.creneau}
      </p>

      {/* Produits — uniquement sur les commandes passées (en-cours : déjà dans CommandeStatusCard) */}
      {variant === 'passee' && (
        <ul className="space-y-0.5">
          {commande.produits.map((p, i) => (
            <li key={i} className="text-sm text-gray-700">
              {p.quantite}× {p.nom}
              {p.options.length > 0 && (
                <span className="text-gray-400">
                  {' '}
                  ({p.options.map((o) => o.nom).join(', ')})
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-50">
        <span className="text-xs text-gray-400">{formatDate(commande.createdAt)}</span>
        <span className="font-bold text-gray-900 text-sm">{formatPrix(commande.total)}</span>
      </div>

      {/* TICK-097 — Bouton suivi sur commandes en cours */}
      {variant === 'en-cours' && onSuivi && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-1"
          onClick={onSuivi}
        >
          Voir le suivi
        </Button>
      )}

      {/* TICK-080 — Bouton re-commande sur commandes passées */}
      {variant === 'passee' && onReorder && (
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-1"
          loading={reorderLoading}
          disabled={reorderLoading}
          onClick={onReorder}
        >
          {reorderLoading ? 'Vérification…' : 'Commander à nouveau'}
        </Button>
      )}
    </div>
  );
}

export default function HistoriqueCommandes() {
  const router = useRouter();
  const [data, setData] = useState<HistoriqueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reorderLoadingId, setReorderLoadingId] = useState<string | null>(null);
  const [reorderMessage, setReorderMessage] = useState<string | null>(null);
  // TICK-097 — commande sélectionnée pour la modale de suivi
  const [suiviCommande, setSuiviCommande] = useState<CommandeHistorique | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchCommandes() {
    try {
      const res = await fetch('/api/client/commandes');
      if (!res.ok) {
        setError(true);
        return;
      }
      const json: HistoriqueData = await res.json();
      setData(json);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCommandes();
    // Polling toutes les 10s pour rafraîchir les commandes en cours
    intervalRef.current = setInterval(fetchCommandes, 10_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // TICK-080 — Re-commande rapide
  async function handleReorder(commande: CommandeHistorique) {
    setReorderLoadingId(commande._id);
    setReorderMessage(null);

    try {
      const res = await fetch('/api/produits');
      // TICK-094 — erreur réseau ou non-200 : message explicite
      if (!res.ok) {
        setReorderMessage('Impossible de vérifier les produits disponibles. Réessayez dans un instant.');
        return;
      }

      const produitsActifs: ProduitActif[] = await res.json();
      // TICK-094 — toString() des deux côtés pour comparaison fiable des ObjectIds sérialisés
      const actifIds = new Set(
        produitsActifs.filter((p) => p.actif).map((p) => p._id.toString())
      );

      const produitsFiltres = commande.produits.filter((p) =>
        actifIds.has(p.produitId.toString())
      );

      if (produitsFiltres.length === 0) {
        setReorderMessage("Aucun produit de cette commande n'est disponible.");
        return;
      }

      // Construire les CartItems pour localStorage
      const cartItems = produitsFiltres.map((p) => {
        const produitActif = produitsActifs.find(
          (pa) => pa._id.toString() === p.produitId.toString()
        );
        return {
          produitId: p.produitId,
          nom: p.nom,
          prix: p.prix,
          quantite: p.quantite,
          options: p.options,
          imageUrl: produitActif?.imageUrl,
        };
      });

      localStorage.setItem('panier', JSON.stringify(cartItems));

      const retires = commande.produits.length - produitsFiltres.length;
      if (retires > 0) {
        setReorderMessage(
          `${retires} produit${retires > 1 ? 's' : ''} ne sont plus disponibles et ont été retirés.`
        );
        // Laisser le message visible brièvement avant la redirection
        setTimeout(() => router.push('/panier'), 1800);
      } else {
        router.push('/panier');
      }
    } catch {
      setReorderMessage('Impossible de vérifier les produits disponibles. Réessayez dans un instant.');
    } finally {
      setReorderLoadingId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-gray-100 rounded-xl h-24 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-gray-400 text-center py-4">
        Impossible de charger vos commandes.
      </p>
    );
  }

  // TICK-098 — max 3 commandes passées côté client
  const passeesAffichees = data?.passees.slice(0, 3) ?? [];
  const totalPassees = data?.passees.length ?? 0;

  return (
    <div className="space-y-6">
      {/* ── Commandes en cours ── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          En cours
        </h3>
        {data?.enCours.length === 0 ? (
          <p className="text-sm text-gray-400">Aucune commande en cours.</p>
        ) : (
          <div className="space-y-3">
            {data?.enCours.map((c) => (
              <CommandeCard
                key={c._id}
                commande={c}
                variant="en-cours"
                onSuivi={() => setSuiviCommande(c)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Commandes passées ── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Historique
        </h3>

        {/* TICK-080 — Message inline (avertissement ou erreur) */}
        {reorderMessage && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
            {reorderMessage}
          </p>
        )}

        {passeesAffichees.length === 0 ? (
          <p className="text-sm text-gray-400">Aucune commande passée.</p>
        ) : (
          <div className="space-y-3">
            {passeesAffichees.map((c) => (
              <CommandeCard
                key={c._id}
                commande={c}
                variant="passee"
                reorderLoading={reorderLoadingId === c._id}
                onReorder={() => handleReorder(c)}
              />
            ))}
          </div>
        )}

        {/* TICK-098 — Lien vers historique complet si > 3 commandes */}
        {totalPassees > 3 && (
          <button
            onClick={() => router.push('/profil/commandes')}
            className="mt-3 text-sm text-orange-600 hover:text-orange-700 font-medium underline underline-offset-2"
          >
            Voir tout l&apos;historique ({totalPassees} commandes)
          </button>
        )}
      </div>

      {/* TICK-097 — Modale de suivi */}
      {suiviCommande && (
        <CommandeSuiviModal
          commande={suiviCommande}
          onClose={() => setSuiviCommande(null)}
        />
      )}
    </div>
  );
}

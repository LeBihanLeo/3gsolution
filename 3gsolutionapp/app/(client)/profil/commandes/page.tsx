'use client';
// TICK-098 — Page historique complet des commandes (timeline par mois)
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { BackLink } from '@/components/ui';

interface ProduitSnapshot {
  produitId: string;
  nom: string;
  quantite: number;
  prix: number;
  options: { nom: string; prix: number }[];
}

interface CommandeHistorique {
  _id: string;
  statut: string;
  produits: ProduitSnapshot[];
  total: number;
  retrait: { type: 'immediat' | 'creneau'; creneau?: string };
  createdAt: string;
  receiptUrl?: string;
}

function idCourt(id: string) {
  return id.slice(-6).toUpperCase();
}

function formatPrix(centimes: number) {
  return (centimes / 100).toFixed(2).replace('.', ',') + ' €';
}

function formatDateComplete(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getMoisAnnee(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function groupByMois(commandes: CommandeHistorique[]): { mois: string; commandes: CommandeHistorique[] }[] {
  const groups: Map<string, CommandeHistorique[]> = new Map();
  for (const c of commandes) {
    const key = getMoisAnnee(c.createdAt);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }
  return Array.from(groups.entries()).map(([mois, commandes]) => ({ mois, commandes }));
}

export default function HistoriqueCompletPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [commandes, setCommandes] = useState<CommandeHistorique[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Protection rôle client
  useEffect(() => {
    if (status === 'unauthenticated' || (status === 'authenticated' && session?.user?.role !== 'client')) {
      router.replace('/auth/login');
    }
  }, [status, session, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/client/commandes')
      .then(async (res) => {
        if (!res.ok) throw new Error('fetch_failed');
        const data = await res.json();
        // Historique complet = passees uniquement, triées antéchronologiquement (déjà triées par l'API)
        setCommandes(data.passees ?? []);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [status]);

  if (status === 'loading' || loading) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8 space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8">
        <p className="text-sm text-gray-400 text-center">
          Impossible de charger votre historique. Réessayez plus tard.
        </p>
      </div>
    );
  }

  const groups = groupByMois(commandes);

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
      {/* Navigation retour */}
      <BackLink href="/profil">Mon profil</BackLink>

      <h1 className="text-xl font-bold text-gray-900">Historique de mes commandes</h1>

      {commandes.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">
          Votre historique de commandes est vide.
        </p>
      ) : (
        <div className="space-y-8">
          {groups.map(({ mois, commandes: cmdsMois }) => (
            <div key={mois}>
              {/* En-tête de mois */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs font-semibold uppercase tracking-widest text-gray-500 capitalize">
                  {mois}
                </span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* Entrées du mois */}
              <div className="space-y-4">
                {cmdsMois.map((c) => (
                  <div key={c._id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
                    {/* En-tête commande */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs font-bold text-gray-500">
                          #{idCourt(c._id)}
                        </span>
                        <p className="text-xs text-gray-400 mt-0.5 capitalize">
                          {formatDateComplete(c.createdAt)}
                        </p>
                      </div>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">
                        Récupérée
                      </span>
                    </div>

                    {/* Produits */}
                    <ul className="space-y-1">
                      {c.produits.map((p, i) => (
                        <li key={i} className="text-sm text-gray-700">
                          {p.quantite}× {p.nom}
                          {p.options.length > 0 && (
                            <span className="text-gray-400">
                              {' '}({p.options.map((o) => o.nom).join(', ')})
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>

                    {/* Créneau + total + reçu */}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                      <span className="text-xs text-gray-500">
                        Retrait :{' '}
                        {c.retrait.type === 'immediat' ? 'Dès que possible' : c.retrait.creneau}
                      </span>
                      <span className="font-bold text-gray-900 text-sm">{formatPrix(c.total)}</span>
                    </div>

                    {/* Lien reçu PDF Stripe */}
                    {c.receiptUrl && (
                      <a
                        href={c.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                        </svg>
                        Voir le reçu
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

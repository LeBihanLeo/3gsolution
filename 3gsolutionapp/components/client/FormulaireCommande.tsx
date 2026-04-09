'use client';

// TICK-040 — Cache client RGPD (email + téléphone)
// TICK-101 — Créneaux filtrés depuis SiteConfig (horaireOuverture / horaireFermeture) + buffer +30 min
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { z } from 'zod';
import { useCart, CartItem } from '@/lib/cartContext';
import { genererCreneaux } from '@/lib/creneaux';

const BUFFER_MIN = 20; // minutes minimum avant le créneau de retrait

// ─── Cache RGPD ─────────────────────────────────────────────────────────────

const CACHE_KEY = 'client_cache';

interface ClientCache {
  nom: string;
  telephone: string;
  email?: string;
}

function readCache(): ClientCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as ClientCache) : null;
  } catch {
    return null;
  }
}

function saveCache(data: ClientCache) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(data));
}

function clearCache() {
  localStorage.removeItem(CACHE_KEY);
}

// ─── Validation ─────────────────────────────────────────────────────────────

const formSchema = z.object({
  nom: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  telephone: z.string().regex(/^0[1-9]\d{8}$/, 'Numéro invalide (10 chiffres, ex : 0612345678)'),
  email: z
    .string()
    .email('Adresse email invalide')
    .optional()
    .or(z.literal('')),
  commentaire: z.string().optional(),
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatPrix(centimes: number): string {
  return (centimes / 100).toFixed(2).replace('.', ',') + ' €';
}

function itemTotal(item: CartItem): number {
  return (item.prix + item.options.reduce((s, o) => s + o.prix, 0)) * item.quantite;
}

/**
 * Filtre les créneaux dont le début est strictement > maintenant + bufferMin.
 * Format attendu : "HH:MM – HH:MM"
 */
export function filtrerCreneauxDisponibles(creneaux: string[], bufferMin: number): string[] {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const limite = nowMin + bufferMin;

  return creneaux.filter((c) => {
    const debut = c.split(' – ')[0];
    if (!debut) return false;
    const [h, m] = debut.split(':').map(Number);
    return h * 60 + m > limite;
  });
}

const inputCls =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500';

// ─── Component ──────────────────────────────────────────────────────────────

export default function FormulaireCommande() {
  const { items, totalPrice } = useCart();
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated';

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  // TICK-101 — créneaux depuis SiteConfig
  const [creneaux, setCreneaux] = useState<string[]>([]);
  const [fermeeAujourdhui, setFermeeAujourdhui] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // ─── Champs contrôlés ───────────────────────────────────────────────────
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');

  // ─── TICK-040 : Cache RGPD ───────────────────────────────────────────────
  const [memoriser, setMemoriser] = useState(false);
  const [cacheExists, setCacheExists] = useState(false);

  // Charger SiteConfig au montage — TICK-101 / TICK-119/120 : cache: 'no-store' pour horaires/fermeture frais
  useEffect(() => {
    fetch('/api/site-config', { cache: 'no-store' })
      .then((r) => r.json())
      .then(({ data }) => {
        if (data) {
          setFermeeAujourdhui(data.fermeeAujourdhui ?? false);
          const ouverture = data.horaireOuverture ?? '11:30';
          const fermeture = data.horaireFermeture ?? '14:00';
          const tous = genererCreneaux(ouverture, fermeture, 15);
          setCreneaux(filtrerCreneauxDisponibles(tous, BUFFER_MIN));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingConfig(false));
  }, []);

  // Pré-remplir les champs selon le contexte (connecté vs invité)
  useEffect(() => {
    if (status === 'loading') return;

    if (isAuthenticated && session?.user) {
      // Utilisateur connecté : pré-remplir depuis la session (nom + email)
      setNom(session.user.name ?? '');
      setEmail(session.user.email ?? '');
      // Téléphone depuis le profil en base (non stocké dans le JWT)
      fetch('/api/client/profil')
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data?.client?.telephone) setTelephone(data.client.telephone);
        })
        .catch(() => {});
    } else if (status === 'unauthenticated') {
      // Mode invité : pré-remplir depuis le cache localStorage si présent
      const cache = readCache();
      if (cache) {
        setCacheExists(true);
        setMemoriser(true);
        setNom(cache.nom);
        setTelephone(cache.telephone);
        setEmail(cache.email ?? '');
      }
    }
  }, [status, isAuthenticated, session]);

  function handleEffacerCache() {
    clearCache();
    setCacheExists(false);
    setMemoriser(false);
    setNom('');
    setTelephone('');
    setEmail('');
  }

  const aucunCreneau = !loadingConfig && !fermeeAujourdhui && creneaux.length === 0;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldErrors({});
    setServerError('');

    const form = e.currentTarget;
    const getField = (name: string) =>
      (form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)?.value ?? '';

    const raw = {
      nom: nom.trim(),
      telephone: telephone.trim(),
      email: email.trim(),
      commentaire: getField('commentaire').trim(),
    };

    const parsed = formSchema.safeParse(raw);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        if (err.path[0]) errs[err.path[0] as string] = err.message;
      });
      setFieldErrors(errs);
      return;
    }

    const creneau = getField('creneau');
    if (!creneau) {
      setFieldErrors({ creneau: 'Veuillez sélectionner un créneau horaire' });
      return;
    }
    if (!creneaux.includes(creneau)) {
      setFieldErrors({ creneau: 'Créneau invalide, veuillez en choisir un dans la liste' });
      return;
    }


    // ─── TICK-040 : gérer le cache RGPD au submit ────────────────────────
    if (isAuthenticated) {
      // Utilisateur connecté : persister le téléphone dans son profil (fire-and-forget)
      // → pré-remplissage automatique à la prochaine visite
      fetch('/api/client/profil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telephone: raw.telephone }),
      }).catch(() => {});
    } else if (memoriser) {
      saveCache({
        nom: raw.nom,
        telephone: raw.telephone,
        ...(raw.email ? { email: raw.email } : {}),
      });
    } else {
      clearCache();
    }

    setLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: {
            nom: raw.nom,
            telephone: raw.telephone,
            ...(raw.email ? { email: raw.email } : {}),
          },
          retrait: { type: 'creneau', creneau },
          ...(raw.commentaire ? { commentaire: raw.commentaire } : {}),
          produits: items.map((item) => ({
            produitId: item.produitId,
            nom: item.nom,
            prix: item.prix,
            quantite: item.quantite,
            options: item.options,
          })),
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setServerError(json.error ?? 'Une erreur est survenue. Réessayez.');
        setLoading(false);
        return;
      }

      // Redirection vers Stripe Checkout
      window.location.href = json.url;
    } catch {
      setServerError('Impossible de contacter le serveur. Vérifiez votre connexion.');
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Votre commande</h1>

      {/* Récapitulatif */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-6">
        <h2 className="font-semibold text-gray-700 mb-3">Récapitulatif</h2>
        <div className="space-y-1">
          {items.map((item, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <span className="text-gray-700">
                {item.quantite}× {item.nom}
                {item.options.length > 0 && (
                  <span className="text-gray-400"> ({item.options.map((o) => o.nom).join(', ')})</span>
                )}
              </span>
              <span className="font-medium text-gray-900">{formatPrix(itemTotal(item))}</span>
            </div>
          ))}
        </div>
        <div className="border-t mt-3 pt-3 flex justify-between font-bold text-gray-900">
          <span>Total</span>
          <span>{formatPrix(totalPrice)}</span>
        </div>
      </div>

      {/* TICK-105 — Boutique fermée manuellement */}
      {!loadingConfig && fermeeAujourdhui && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6 text-sm text-red-700 font-medium">
          La boutique est fermée pour aujourd&apos;hui. Revenez demain !
        </div>
      )}

      {/* Formulaire */}
      <form onSubmit={handleSubmit} className="space-y-4">

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nom <span className="text-red-400">*</span>
          </label>
          <input
            name="nom"
            type="text"
            required
            autoComplete="name"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            className={inputCls}
          />
          {fieldErrors.nom && <p className="text-xs text-red-500 mt-1">{fieldErrors.nom}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Téléphone <span className="text-red-400">*</span>
          </label>
          <input
            name="telephone"
            type="tel"
            inputMode="numeric"
            required
            placeholder="0612345678"
            autoComplete="tel"
            maxLength={10}
            value={telephone}
            onChange={(e) => setTelephone(e.target.value.replace(/\D/g, ''))}
            className={inputCls}
          />
          {fieldErrors.telephone && (
            <p className="text-xs text-red-500 mt-1">{fieldErrors.telephone}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email <span className="text-gray-400 font-normal">(optionnel, pour confirmation)</span>
          </label>
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="vous@exemple.fr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
          />
          {fieldErrors.email && <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>}
        </div>

        {/* Créneau de retrait — toujours affiché */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Créneau de retrait <span className="text-red-400">*</span>
          </label>
          {loadingConfig ? (
            <p className="text-sm text-gray-400">Chargement des créneaux…</p>
          ) : aucunCreneau ? (
            <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Aucun créneau disponible pour aujourd&apos;hui. La boutique ferme bientôt.
            </p>
          ) : fermeeAujourdhui ? null : (
            <select name="creneau" className={`${inputCls} w-full`} defaultValue="">
              <option value="">— Choisir un créneau —</option>
              {creneaux.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
          {fieldErrors.creneau && (
            <p className="text-xs text-red-500 mt-1">{fieldErrors.creneau}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Commentaire <span className="text-gray-400 font-normal">(optionnel)</span>
          </label>
          <textarea
            name="commentaire"
            rows={2}
            placeholder="Allergies, sans oignons, etc."
            className={`${inputCls} resize-none`}
          />
        </div>

        {/* ─── TICK-040 : Cache RGPD — masqué si connecté ────────────────── */}
        {!isAuthenticated && <div className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
          <label
            htmlFor="memoriser-checkbox"
            className="flex items-start gap-2.5 cursor-pointer"
          >
            <input
              id="memoriser-checkbox"
              type="checkbox"
              checked={memoriser}
              onChange={(e) => setMemoriser(e.target.checked)}
              aria-describedby="memoriser-info"
              className="mt-0.5 accent-orange-600 shrink-0"
            />
            <span className="text-sm text-gray-700">
              Mémoriser mes informations sur cet appareil pour mes prochaines commandes
            </span>
          </label>
          <p id="memoriser-info" className="text-xs text-gray-500 pl-6">
            Ces informations restent sur votre appareil et ne sont jamais transmises à nos serveurs.
          </p>
          {cacheExists && (
            <button
              type="button"
              onClick={handleEffacerCache}
              className="ml-6 text-xs text-red-600 hover:underline"
            >
              Effacer mes informations
            </button>
          )}
        </div>}

        {serverError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {serverError}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || items.length === 0 || fermeeAujourdhui || aucunCreneau}
          className="w-full bg-orange-600 hover:bg-orange-700 active:bg-orange-800 disabled:opacity-50 text-white font-semibold py-3 rounded-2xl transition-colors"
        >
          {loading ? 'Redirection vers le paiement…' : 'Payer →'}
        </button>
      </form>
    </div>
  );
}

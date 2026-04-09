'use client';

import { SitePalette } from '@/lib/palette';

interface PersonnalisationApercuProps {
  nomRestaurant: string;
  banniereUrl: string;
  horaireOuverture: string;
  horaireFermeture: string;
  palette: SitePalette;
}

export default function PersonnalisationApercu({
  nomRestaurant,
  banniereUrl,
  horaireOuverture,
  horaireFermeture,
  palette,
}: PersonnalisationApercuProps) {
  const displayName = nomRestaurant || 'Mon Restaurant';

  return (
    <div className="border rounded-xl overflow-hidden shadow-sm bg-stone-50">
      {/* Header simulé */}
      <div className="bg-white border-b px-3 py-2 flex items-center justify-between">
        <span
          className="font-bold text-gray-900 uppercase tracking-widest"
          style={{ fontSize: '9px', fontFamily: 'var(--font-display)' }}
        >
          {displayName}
        </span>
        <div className="w-5 h-5 rounded-full bg-gray-100" />
      </div>

      {/* Bannière avec fondu */}
      {banniereUrl ? (
        <div
          data-testid="hero"
          className="relative w-full"
          style={{
            backgroundImage: `url(${banniereUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            minHeight: '110px',
          }}
        >
          {/* Gradient fondu vers le bas — identique au vrai rendu */}
          <div className="absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-b from-transparent to-stone-50" />
          {/* Horaire pill */}
          <div className="absolute bottom-2 left-2">
            <span
              className="inline-flex items-center gap-1 rounded-full bg-white shadow-sm text-gray-800 font-semibold px-2 py-0.5"
              style={{ fontSize: '7px' }}
            >
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#EA580C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {horaireOuverture} – {horaireFermeture}
            </span>
          </div>
        </div>
      ) : (
        <div
          className="w-full flex items-center justify-center py-8"
          style={{ background: palette.surface }}
        >
          <span className="text-gray-300" style={{ fontSize: '28px' }}>🍽</span>
        </div>
      )}

      {/* Faux produits — simule les MenuCards */}
      <div className="px-3 py-3 space-y-2">
        {[
          { w: '3/4', w2: '1/2' },
          { w: '2/3', w2: '2/5' },
          { w: '4/5', w2: '3/5' },
        ].map((sizes, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-gray-100 flex items-center gap-2 p-2"
          >
            <div className="w-10 h-10 rounded-xl bg-gray-100 shrink-0" />
            <div className="flex-1 space-y-1 min-w-0">
              <div className={`h-2 bg-gray-200 rounded w-${sizes.w}`} />
              <div className={`h-1.5 bg-gray-100 rounded w-${sizes.w2}`} />
            </div>
            <div
              className="shrink-0 rounded-xl px-2 py-1 text-white font-semibold"
              style={{ backgroundColor: palette.primary, fontSize: '7px' }}
            >
              + Ajouter
            </div>
          </div>
        ))}
      </div>

      {/* Faux bouton "Voir le panier" — visible uniquement mobile, masqué desktop */}
      <div className="px-3 pb-3">
        <div
          className="rounded-2xl py-2 text-center text-white font-semibold flex items-center justify-center gap-2"
          style={{ backgroundColor: palette.primary, fontSize: '8px' }}
        >
          <span>Voir le panier</span>
          <span
            className="bg-white rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold"
            style={{ color: palette.primary, fontSize: '7px' }}
          >
            2
          </span>
        </div>
      </div>
    </div>
  );
}

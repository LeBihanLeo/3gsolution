'use client';

interface PersonnalisationApercuProps {
  nomRestaurant: string;
  banniereUrl: string;
}

export default function PersonnalisationApercu({
  nomRestaurant,
  banniereUrl,
}: PersonnalisationApercuProps) {
  return (
    <div className="border rounded-xl overflow-hidden shadow-sm bg-white">
      {banniereUrl ? (
        /* ── Hero bannière ── */
        <div
          data-testid="hero"
          className="w-full flex items-center justify-center"
          style={{
            backgroundImage: `url(${banniereUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            minHeight: '140px',
          }}
        >
          <div className="flex items-center gap-4 w-full px-6">
            <div className="flex-1 h-px bg-white" />
            <span
              className="text-white text-xl whitespace-nowrap shrink-0 uppercase tracking-widest"
              style={{
                fontFamily: 'var(--font-montserrat)',
                fontWeight: 700,
                textShadow:
                  '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
              }}
            >
              {nomRestaurant || 'Mon Restaurant'}
            </span>
            <div className="flex-1 h-px bg-white" />
          </div>
        </div>
      ) : (
        /* ── Fallback ── */
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <span className="text-xl">🍔</span>
          <span className="font-bold text-gray-900 text-lg">
            {nomRestaurant || 'Mon Restaurant'}
          </span>
        </div>
      )}

      {/* Body placeholder */}
      <div className="px-6 py-4 space-y-2">
        <div className="h-3 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
        <div className="h-3 bg-gray-200 rounded w-2/3" />
      </div>
    </div>
  );
}

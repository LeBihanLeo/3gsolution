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
      {/* Bannière */}
      {banniereUrl && (
        <div className="w-full max-h-[120px] overflow-hidden">
          <img
            src={banniereUrl}
            alt="Aperçu bannière"
            className="w-full object-cover max-h-[120px]"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}

      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center gap-2">
        <span className="text-xl">🍔</span>
        <span className="font-bold text-gray-900 text-lg">
          {nomRestaurant || 'Mon Restaurant'}
        </span>
      </div>

      {/* Body placeholder */}
      <div className="px-6 py-4 space-y-2">
        <div className="h-3 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
        <div className="h-3 bg-gray-200 rounded w-2/3" />
      </div>
    </div>
  );
}

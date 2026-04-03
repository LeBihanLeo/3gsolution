'use client';

export default function OfflinePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 text-center bg-gray-50">
      <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-md">
        <img src="/icons/icon-192x192.png" alt="3G Solution" width={80} height={80} />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">Vous êtes hors ligne</h1>
        <p className="text-gray-500 max-w-xs">
          Vérifiez votre connexion internet et réessayez.
        </p>
      </div>

      <button
        onClick={() => window.location.reload()}
        className="px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors"
      >
        Réessayer
      </button>
    </main>
  );
}

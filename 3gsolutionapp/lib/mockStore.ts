// TICK-055 — SEC-07 : Stockage mock sécurisé (développement/staging uniquement)
// - TTL de 30 minutes sur chaque session (nettoyage automatique à la lecture)
// - La route API vérifie NODE_ENV !== 'production' en plus de STRIPE_SECRET_KEY

const MOCK_TTL_MS = 30 * 60 * 1000; // 30 minutes

export interface MockSessionData {
  client: {
    nom: string;
    telephone: string;
    email?: string;
  };
  retrait: {
    type: 'immediat' | 'creneau';
    creneau?: string;
  };
  commentaire?: string;
  produits: {
    produitId: string;
    nom: string;
    prix: number;
    quantite: number;
    options: { nom: string; prix: number }[];
  }[];
  // TICK-075 — clientId MongoDB si client connecté (undefined = commande invité)
  clientId?: string;
}

interface MockSessionEntry {
  data: MockSessionData;
  expiresAt: number; // Date.now() + TTL
}

// Global pour survivre au hot-reload Next.js en développement
const globalWithMock = global as typeof globalThis & {
  _mockSessions?: Map<string, MockSessionEntry>;
};

if (!globalWithMock._mockSessions) {
  globalWithMock._mockSessions = new Map();
}

const store = globalWithMock._mockSessions;

/** Nettoie les sessions expirées (appelé à chaque lecture/écriture) */
function purgeExpired(): void {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now >= entry.expiresAt) {
      store.delete(key);
    }
  }
}

export const mockSessions = {
  set(id: string, data: MockSessionData): void {
    purgeExpired();
    store.set(id, { data, expiresAt: Date.now() + MOCK_TTL_MS });
  },

  get(id: string): MockSessionData | undefined {
    purgeExpired();
    const entry = store.get(id);
    if (!entry) return undefined;
    if (Date.now() >= entry.expiresAt) {
      store.delete(id);
      return undefined;
    }
    return entry.data;
  },

  delete(id: string): void {
    store.delete(id);
  },
};

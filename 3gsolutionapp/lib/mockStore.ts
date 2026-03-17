// Stockage en mémoire des sessions mock (développement uniquement)
// Remis à zéro à chaque redémarrage du serveur, ce qui est intentionnel.

export interface MockSession {
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
}

// Global pour survivre au hot-reload Next.js
const globalWithMock = global as typeof globalThis & {
  mockSessions?: Map<string, MockSession>;
};

if (!globalWithMock.mockSessions) {
  globalWithMock.mockSessions = new Map();
}

export const mockSessions = globalWithMock.mockSessions;

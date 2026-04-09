/**
 * TICK-114 — Tests HistoriqueCommandes
 * - Fix parse { data } de GET /api/produits
 * - Bouton re-commande variant ghost (texte visible, accessible)
 * - Logique re-commande : redirection panier, message si produit retiré, message si aucun dispo
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import HistoriqueCommandes from '@/components/client/HistoriqueCommandes';

// ── Mocks infrastructure ─────────────────────────────────────────────────────

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/components/client/CommandeSuiviModal', () => ({
  __esModule: true,
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="suivi-modal">
      <button onClick={onClose}>Fermer</button>
    </div>
  ),
}));

vi.mock('@/components/client/StatutBadge', () => ({
  StatutBadge: ({ statut }: { statut: string }) => <span>{statut}</span>,
}));

vi.mock('@/components/client/CommandeStatusCard', () => ({
  CommandeStatusCard: () => <div data-testid="commande-status-card" />,
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

const commandePassee = {
  _id: 'cmd001',
  statut: 'recuperee' as const,
  produits: [
    { produitId: 'prod1', nom: 'Burger', quantite: 1, prix: 1000, options: [] },
    { produitId: 'prod2', nom: 'Frites', quantite: 1, prix: 300, options: [] },
  ],
  total: 1300,
  retrait: { type: 'immediat' as const },
  createdAt: new Date('2026-03-01').toISOString(),
};

const historiqueVide = { enCours: [], passees: [] };
const historiqueAvecPassee = { enCours: [], passees: [commandePassee] };

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockFetch(historiqueData: object, produitsData?: object) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url === '/api/client/commandes') {
      return new Response(JSON.stringify(historiqueData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url === '/api/produits') {
      const ok = produitsData !== undefined;
      return new Response(ok ? JSON.stringify(produitsData) : '', {
        status: ok ? 200 : 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(null, { status: 404 });
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('HistoriqueCommandes — rendu de base', () => {
  it('affiche le skeleton pendant le chargement', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise<Response>(() => {}));
    render(<HistoriqueCommandes />);
    expect(document.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('affiche "Aucune commande en cours" et "Aucune commande passée" quand vide', async () => {
    mockFetch(historiqueVide);
    render(<HistoriqueCommandes />);
    await waitFor(() => {
      expect(screen.getByText(/aucune commande en cours/i)).toBeTruthy();
      expect(screen.getByText(/aucune commande passée/i)).toBeTruthy();
    });
  });

  it('affiche le bouton "Commander à nouveau" pour les commandes passées', async () => {
    mockFetch(historiqueAvecPassee);
    render(<HistoriqueCommandes />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /commander à nouveau/i })).toBeTruthy();
    });
  });
});

describe('TICK-114 — Fix parse { data } GET /api/produits', () => {
  it('ne déclenche pas d\'erreur quand l\'API retourne { data: [...] }', async () => {
    mockFetch(historiqueAvecPassee, {
      data: [
        { _id: 'prod1', nom: 'Burger', prix: 1000, options: [], actif: true },
        { _id: 'prod2', nom: 'Frites', prix: 300, options: [], actif: true },
      ],
    });

    render(<HistoriqueCommandes />);
    await waitFor(() => screen.getByRole('button', { name: /commander à nouveau/i }));

    fireEvent.click(screen.getByRole('button', { name: /commander à nouveau/i }));

    await waitFor(() => {
      // Pas de message d'erreur "Impossible de vérifier"
      expect(screen.queryByText(/impossible de vérifier/i)).toBeNull();
      // Redirection vers /panier
      expect(mockPush).toHaveBeenCalledWith('/panier');
    });
  });

  it('affiche un message d\'erreur si l\'API produits retourne non-ok', async () => {
    mockFetch(historiqueAvecPassee, undefined);

    render(<HistoriqueCommandes />);
    await waitFor(() => screen.getByRole('button', { name: /commander à nouveau/i }));

    fireEvent.click(screen.getByRole('button', { name: /commander à nouveau/i }));

    await waitFor(() => {
      expect(screen.getByText(/impossible de vérifier/i)).toBeTruthy();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('affiche un message si aucun produit de la commande n\'est disponible', async () => {
    mockFetch(historiqueAvecPassee, {
      data: [
        // prod1 et prod2 existent mais sont inactifs
        { _id: 'prod1', nom: 'Burger', prix: 1000, options: [], actif: false },
        { _id: 'prod2', nom: 'Frites', prix: 300, options: [], actif: false },
      ],
    });

    render(<HistoriqueCommandes />);
    await waitFor(() => screen.getByRole('button', { name: /commander à nouveau/i }));

    fireEvent.click(screen.getByRole('button', { name: /commander à nouveau/i }));

    await waitFor(() => {
      expect(screen.getByText(/aucun produit de cette commande/i)).toBeTruthy();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('affiche un avertissement et redirige après 1800ms si certains produits retirés', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockFetch(historiqueAvecPassee, {
      data: [
        { _id: 'prod1', nom: 'Burger', prix: 1000, options: [], actif: true },
        // prod2 absent → retiré
      ],
    });

    render(<HistoriqueCommandes />);
    await waitFor(() => screen.getByRole('button', { name: /commander à nouveau/i }));

    fireEvent.click(screen.getByRole('button', { name: /commander à nouveau/i }));

    await waitFor(() => {
      expect(screen.getByText(/ne sont plus disponibles/i)).toBeTruthy();
    });
    expect(mockPush).not.toHaveBeenCalled();

    // Après 1800ms → redirection
    vi.advanceTimersByTime(1800);
    expect(mockPush).toHaveBeenCalledWith('/panier');
    vi.useRealTimers();
  });

  it('stocke les items dans localStorage avant la redirection', async () => {
    mockFetch(historiqueAvecPassee, {
      data: [
        { _id: 'prod1', nom: 'Burger', prix: 1000, options: [], actif: true },
        { _id: 'prod2', nom: 'Frites', prix: 300, options: [], actif: true },
      ],
    });

    render(<HistoriqueCommandes />);
    await waitFor(() => screen.getByRole('button', { name: /commander à nouveau/i }));

    fireEvent.click(screen.getByRole('button', { name: /commander à nouveau/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalled());

    const panier = JSON.parse(localStorage.getItem('panier') ?? '[]');
    expect(panier).toHaveLength(2);
    expect(panier[0].produitId).toBe('prod1');
  });
});

describe('TICK-114 — Bouton ghost accessible', () => {
  it('le bouton "Commander à nouveau" est accessible et non désactivé au repos', async () => {
    mockFetch(historiqueAvecPassee);
    render(<HistoriqueCommandes />);
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /commander à nouveau/i });
      expect(btn).not.toBeDisabled();
    });
  });
});

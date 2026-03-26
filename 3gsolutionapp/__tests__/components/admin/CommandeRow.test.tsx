// TICK-099, TICK-104 — Tests mis à jour pour les nouvelles transitions (onAdvance)
// TICK-107 — Bouton "Anonymiser" retiré, prop onSupprimer supprimée
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CommandeRow, { CommandeData, StatutCommande } from '@/components/admin/CommandeRow';

const makeCommande = (overrides: Partial<CommandeData> = {}): CommandeData => ({
  _id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
  statut: 'payee',
  client: { nom: 'Jean Dupont', telephone: '0612345678' },
  retrait: { type: 'immediat' },
  produits: [{ nom: 'Burger', prix: 850, quantite: 1, options: [] }],
  total: 850,
  createdAt: new Date().toISOString(),
  ...overrides,
});

describe('CommandeRow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('affiche : ID court, nom client, téléphone, total, statut', () => {
    render(<CommandeRow commande={makeCommande()} onAdvance={vi.fn()} />);
    expect(screen.getByText(/AAAAAA/)).toBeInTheDocument();
    expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
    expect(screen.getByText('0612345678')).toBeInTheDocument();
    expect(screen.getByText('8,50 €')).toBeInTheDocument();
    expect(screen.getByText('Payée')).toBeInTheDocument();
  });

  // TICK-104 — Transitions par statut
  it('statut "payee" → bouton "En préparation →" visible', () => {
    render(<CommandeRow commande={makeCommande({ statut: 'payee' })} onAdvance={vi.fn()} />);
    expect(screen.getByRole('button', { name: /en préparation/i })).toBeInTheDocument();
  });

  it('statut "en_preparation" → bouton "Prête →" visible', () => {
    render(<CommandeRow commande={makeCommande({ statut: 'en_preparation' })} onAdvance={vi.fn()} />);
    expect(screen.getByRole('button', { name: /prête/i })).toBeInTheDocument();
  });

  it('statut "prete" → bouton "Récupérée ✓" visible', () => {
    render(<CommandeRow commande={makeCommande({ statut: 'prete' })} onAdvance={vi.fn()} />);
    expect(screen.getByRole('button', { name: /récupérée/i })).toBeInTheDocument();
  });

  it('statut "recuperee" → aucun bouton transition', () => {
    render(<CommandeRow commande={makeCommande({ statut: 'recuperee' })} onAdvance={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /en préparation|prête|récupérée ✓/i })).not.toBeInTheDocument();
  });

  it('clic "En préparation →" → onAdvance appelé avec ID + "en_preparation"', async () => {
    const onAdvance = vi.fn().mockResolvedValue(undefined);
    render(<CommandeRow commande={makeCommande({ statut: 'payee' })} onAdvance={onAdvance} />);
    fireEvent.click(screen.getByRole('button', { name: /en préparation/i }));
    await waitFor(() =>
      expect(onAdvance).toHaveBeenCalledWith('aaaaaaaaaaaaaaaaaaaaaaaa', 'en_preparation' as StatutCommande)
    );
  });

  it('retrait immediat → affiche "Dès que possible"', () => {
    render(<CommandeRow commande={makeCommande({ retrait: { type: 'immediat' } })} onAdvance={vi.fn()} />);
    expect(screen.getByText(/dès que possible/i)).toBeInTheDocument();
  });

  it('retrait créneau → affiche le créneau horaire', () => {
    render(
      <CommandeRow
        commande={makeCommande({ retrait: { type: 'creneau', creneau: '12:00 – 12:15' } })}
        onAdvance={vi.fn()}
      />
    );
    expect(screen.getByText(/12:00 – 12:15/)).toBeInTheDocument();
  });

  it('clic "Voir le détail" → affiche les produits', () => {
    render(<CommandeRow commande={makeCommande()} onAdvance={vi.fn()} />);
    fireEvent.click(screen.getByText(/voir le détail/i));
    expect(screen.getByText(/Burger/)).toBeInTheDocument();
  });
});

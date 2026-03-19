import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CommandeRow, { CommandeData } from '@/components/admin/CommandeRow';

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
    render(<CommandeRow commande={makeCommande()} onMarquerPrete={vi.fn()} />);
    expect(screen.getByText(/AAAAAA/)).toBeInTheDocument(); // 6 derniers chars de l'ID
    expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
    expect(screen.getByText('0612345678')).toBeInTheDocument();
    expect(screen.getByText('8,50 €')).toBeInTheDocument();
    expect(screen.getByText('Payée')).toBeInTheDocument();
  });

  it('statut "payee" → bouton "Marquer prête" visible', () => {
    render(<CommandeRow commande={makeCommande({ statut: 'payee' })} onMarquerPrete={vi.fn()} />);
    expect(screen.getByRole('button', { name: /marquer prête/i })).toBeInTheDocument();
  });

  it('statut "prete" → bouton absent', () => {
    render(<CommandeRow commande={makeCommande({ statut: 'prete' })} onMarquerPrete={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /marquer prête/i })).not.toBeInTheDocument();
  });

  it('clic "Marquer prête" → onMarquerPrete appelé avec l\'ID', async () => {
    const onMarquerPrete = vi.fn().mockResolvedValue(undefined);
    render(<CommandeRow commande={makeCommande()} onMarquerPrete={onMarquerPrete} />);
    fireEvent.click(screen.getByRole('button', { name: /marquer prête/i }));
    await waitFor(() => expect(onMarquerPrete).toHaveBeenCalledWith('aaaaaaaaaaaaaaaaaaaaaaaa'));
  });

  it('retrait immediat → affiche "Dès que possible"', () => {
    render(<CommandeRow commande={makeCommande({ retrait: { type: 'immediat' } })} onMarquerPrete={vi.fn()} />);
    expect(screen.getByText(/dès que possible/i)).toBeInTheDocument();
  });

  it('retrait créneau → affiche le créneau horaire', () => {
    render(
      <CommandeRow
        commande={makeCommande({ retrait: { type: 'creneau', creneau: '12:00 – 12:15' } })}
        onMarquerPrete={vi.fn()}
      />
    );
    expect(screen.getByText(/12:00 – 12:15/)).toBeInTheDocument();
  });

  it('clic "Voir le détail" → affiche les produits', () => {
    render(<CommandeRow commande={makeCommande()} onMarquerPrete={vi.fn()} />);
    fireEvent.click(screen.getByText(/voir le détail/i));
    expect(screen.getByText(/Burger/)).toBeInTheDocument();
  });
});

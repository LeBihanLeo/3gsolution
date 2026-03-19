import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Mock DropZone — testé indépendamment dans DropZone.test.tsx
vi.mock('@/components/admin/DropZone', () => ({
  default: ({
    label,
  }: {
    label: string;
    currentImageUrl?: string;
    onUploadSuccess: (url: string) => void;
    onRemove: () => void;
  }) => React.createElement('div', { 'data-testid': 'dropzone' }, label),
}));

import ProduitForm from '@/components/admin/ProduitForm';

const mockSubmit = vi.fn();
const mockCancel = vi.fn();

const defaultProps = {
  onSubmit: mockSubmit,
  onCancel: mockCancel,
};

const PRODUIT_EXISTANT = {
  _id: 'abc123',
  nom: 'Burger Classic',
  description: 'Un bon burger',
  categorie: 'Burgers',
  prix: 850, // centimes
  options: [{ nom: 'Fromage', prix: 50 }],
  actif: true,
};

describe('ProduitForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubmit.mockResolvedValue(undefined);
  });

  it('mode création : champs vides et bouton "Créer le produit"', () => {
    render(<ProduitForm {...defaultProps} />);
    expect(screen.getByRole('button', { name: /créer le produit/i })).toBeInTheDocument();
    const nomInput = screen.getByPlaceholderText('Burger Classic') as HTMLInputElement;
    expect(nomInput.defaultValue).toBe('');
  });

  it('mode édition : champs pré-remplis et bouton "Mettre à jour"', () => {
    render(<ProduitForm initial={PRODUIT_EXISTANT} {...defaultProps} />);
    expect(screen.getByRole('button', { name: /mettre à jour/i })).toBeInTheDocument();
    const nomInput = screen.getByPlaceholderText('Burger Classic') as HTMLInputElement;
    expect(nomInput.defaultValue).toBe('Burger Classic');
    const descInput = screen.getByPlaceholderText(/steak haché/i) as HTMLTextAreaElement;
    expect(descInput.defaultValue).toBe('Un bon burger');
  });

  it('prix mode édition → converti en euros (8,50)', () => {
    render(<ProduitForm initial={PRODUIT_EXISTANT} {...defaultProps} />);
    const prixInput = screen.getByPlaceholderText('8,50') as HTMLInputElement;
    expect(prixInput.defaultValue).toBe('8,50');
  });

  it('submit sans nom → erreur Zod visible, onSubmit non appelé', async () => {
    render(<ProduitForm {...defaultProps} />);
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => {
      expect(screen.getByText(/le nom est requis/i)).toBeInTheDocument();
    });
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('submit avec prix invalide → erreur Zod visible', async () => {
    render(<ProduitForm {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText('Burger Classic'), { target: { value: 'Produit' } });
    fireEvent.change(screen.getByPlaceholderText(/steak haché/i), { target: { value: 'Desc' } });
    fireEvent.change(screen.getByPlaceholderText('Burgers, Boissons...'), { target: { value: 'Cat' } });
    fireEvent.change(screen.getByPlaceholderText('8,50'), { target: { value: 'abc' } });
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => {
      expect(screen.getByText(/prix invalide/i)).toBeInTheDocument();
    });
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('ajout d\'option dynamique → nouvelle ligne de champs visible', () => {
    render(<ProduitForm {...defaultProps} />);
    expect(screen.queryByPlaceholderText('Ex : Fromage supplémentaire')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(/ajouter une option/i));
    expect(screen.getByPlaceholderText('Ex : Fromage supplémentaire')).toBeInTheDocument();
  });

  it('suppression d\'option → ligne retirée', () => {
    render(<ProduitForm initial={PRODUIT_EXISTANT} {...defaultProps} />);
    expect(screen.getByDisplayValue('Fromage')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Supprimer cette option'));
    expect(screen.queryByDisplayValue('Fromage')).not.toBeInTheDocument();
  });

  it('submit valide (création) → onSubmit appelé avec les bonnes valeurs', async () => {
    render(<ProduitForm {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText('Burger Classic'), { target: { value: 'Nouveau burger' } });
    fireEvent.change(screen.getByPlaceholderText(/steak haché/i), { target: { value: 'Une description' } });
    fireEvent.change(screen.getByPlaceholderText('Burgers, Boissons...'), { target: { value: 'Burgers' } });
    fireEvent.change(screen.getByPlaceholderText('8,50'), { target: { value: '9,90' } });
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          nom: 'Nouveau burger',
          prix: 990,
          categorie: 'Burgers',
          description: 'Une description',
          options: [],
          actif: true,
        })
      );
    });
  });

  it('option avec nom vide → erreur "option X : le nom est requis"', async () => {
    render(<ProduitForm {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText('Burger Classic'), { target: { value: 'Produit' } });
    fireEvent.change(screen.getByPlaceholderText(/steak haché/i), { target: { value: 'Desc' } });
    fireEvent.change(screen.getByPlaceholderText('Burgers, Boissons...'), { target: { value: 'Cat' } });
    fireEvent.change(screen.getByPlaceholderText('8,50'), { target: { value: '5,00' } });
    // Ajout d'une option avec nom vide
    fireEvent.click(screen.getByText(/ajouter une option/i));
    // Laisse le nom vide, soumet
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => {
      expect(screen.getByText(/option 1 : le nom est requis/i)).toBeInTheDocument();
    });
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('toggle statut → bascule entre "Actif" et "Inactif"', () => {
    render(<ProduitForm {...defaultProps} />);
    const toggleBtn = screen.getByRole('button', { name: /actif/i });
    expect(toggleBtn).toHaveTextContent('Actif');
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveTextContent('Inactif');
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveTextContent('Actif');
  });

  it('bouton "Annuler" → onCancel appelé', () => {
    render(<ProduitForm {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /annuler/i }));
    expect(mockCancel).toHaveBeenCalledOnce();
  });

  it('DropZone rendu avec le bon label', () => {
    render(<ProduitForm {...defaultProps} />);
    expect(screen.getByTestId('dropzone')).toHaveTextContent('Image du produit');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock next/image → img simple (fill/sizes filtrés : pas des attributs HTML valides)
vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    fill: _fill,
    sizes: _sizes,
    ...props
  }: {
    src: string;
    alt: string;
    fill?: boolean;
    sizes?: string;
    [key: string]: unknown;
  }) => React.createElement('img', { src, alt, ...props }),
}));

// Mock useCart
const mockAddItem = vi.fn();
const mockUpdateQuantity = vi.fn();
vi.mock('@/lib/cartContext', () => ({
  useCart: () => ({ items: [], addItem: mockAddItem, updateQuantity: mockUpdateQuantity }),
}));

import MenuCard from '@/components/client/MenuCard';

const defaultProps = {
  produitId: 'p1',
  nom: 'Burger Classic',
  description: 'Un bon burger avec de la salade',
  prix: 850, // centimes
  options: [],
};

describe('MenuCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('affiche le nom, la description et le prix formaté', () => {
    render(<MenuCard {...defaultProps} />);
    expect(screen.getByText('Burger Classic')).toBeInTheDocument();
    expect(screen.getByText('Un bon burger avec de la salade')).toBeInTheDocument();
    expect(screen.getByText('8,50 €')).toBeInTheDocument();
  });

  it('imageUrl présent → img avec alt = nom du produit', () => {
    render(<MenuCard {...defaultProps} imageUrl="https://example.com/burger.jpg" />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('alt', 'Burger Classic');
    expect(img).toHaveAttribute('src', 'https://example.com/burger.jpg');
  });

  it("imageUrl absent → pas d'élément img", () => {
    render(<MenuCard {...defaultProps} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('clic "+" → addItem appelé avec le bon produit', () => {
    render(<MenuCard {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /ajouter burger classic au panier/i }));
    expect(mockAddItem).toHaveBeenCalledOnce();
    expect(mockAddItem).toHaveBeenCalledWith(
      expect.objectContaining({ produitId: 'p1', nom: 'Burger Classic', prix: 850 })
    );
  });

  // TICK-096 — bouton + uniforme sur produits avec options
  it('TICK-096 — produit avec options → bouton "+" avec aria-label', () => {
    render(
      <MenuCard
        {...defaultProps}
        options={[{ nom: 'Supplément fromage', prix: 50 }]}
      />
    );
    const btn = screen.getByRole('button', { name: /ajouter burger classic au panier/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent('+');
  });

  it('TICK-096 — bouton + sans options → aria-label correct', () => {
    render(<MenuCard {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Ajouter Burger Classic au panier' })).toBeInTheDocument();
  });

  it('options visibles après clic sur "Personnaliser"', () => {
    render(
      <MenuCard
        {...defaultProps}
        options={[{ nom: 'Supplément fromage', prix: 50 }]}
      />
    );
    fireEvent.click(screen.getByText(/personnaliser/i));
    expect(screen.getByText('Supplément fromage')).toBeInTheDocument();
  });
});

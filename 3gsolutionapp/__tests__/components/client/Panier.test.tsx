import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Mock next/image → img simple (sans props non-HTML)
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

// Mock next/link → ancre simple
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => React.createElement('a', { href, ...props }, children),
}));

import { CartProvider } from '@/lib/cartContext';
import Panier from '@/components/client/Panier';

const ITEM_SIMPLE = {
  produitId: 'p1',
  nom: 'Burger Classic',
  prix: 850,
  quantite: 2,
  options: [],
};

const ITEM_AVEC_IMAGE = {
  produitId: 'p2',
  nom: 'Frites',
  prix: 300,
  quantite: 1,
  options: [],
  imageUrl: 'https://example.com/frites.jpg',
};

const ITEM_AVEC_OPTION = {
  produitId: 'p3',
  nom: 'Boisson',
  prix: 200,
  quantite: 1,
  options: [{ nom: 'Sirop fraise', prix: 30 }],
};

function renderPanier() {
  return render(
    <CartProvider>
      <Panier />
    </CartProvider>
  );
}

describe('Panier', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('panier vide → message "Votre panier est vide" et lien retour menu', () => {
    renderPanier();
    expect(screen.getByText(/votre panier est vide/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /retour au menu/i })).toBeInTheDocument();
  });

  it('panier non vide → nom, total et bouton "Vider" affichés', async () => {
    localStorage.setItem('panier', JSON.stringify([ITEM_SIMPLE]));
    renderPanier();
    await waitFor(() => {
      expect(screen.getByText('Burger Classic')).toBeInTheDocument();
    });
    // 850 * 2 = 1700 centimes = 17,00 € (affiché dans la ligne item ET dans le total)
    expect(screen.getAllByText('17,00 €').length).toBeGreaterThan(0);
    expect(screen.getByText(/vider le panier/i)).toBeInTheDocument();
  });

  it('item avec imageUrl → image affichée avec alt = nom', async () => {
    localStorage.setItem('panier', JSON.stringify([ITEM_AVEC_IMAGE]));
    renderPanier();
    await waitFor(() => {
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('alt', 'Frites');
      expect(img).toHaveAttribute('src', 'https://example.com/frites.jpg');
    });
  });

  it('item sans imageUrl → pas d\'image', async () => {
    localStorage.setItem('panier', JSON.stringify([ITEM_SIMPLE]));
    renderPanier();
    await waitFor(() => {
      expect(screen.getByText('Burger Classic')).toBeInTheDocument();
    });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('item avec options → noms des options affichés', async () => {
    localStorage.setItem('panier', JSON.stringify([ITEM_AVEC_OPTION]));
    renderPanier();
    await waitFor(() => {
      expect(screen.getByText(/sirop fraise/i)).toBeInTheDocument();
    });
  });

  it('bouton "Vider le panier" → panier réinitialisé', async () => {
    localStorage.setItem('panier', JSON.stringify([ITEM_SIMPLE]));
    renderPanier();
    await waitFor(() => {
      expect(screen.getByText('Burger Classic')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/vider le panier/i));
    await waitFor(() => {
      expect(screen.getByText(/votre panier est vide/i)).toBeInTheDocument();
    });
    expect(JSON.parse(localStorage.getItem('panier')!)).toEqual([]);
  });

  it('bouton "Augmenter" → quantité et total incrémentés', async () => {
    localStorage.setItem('panier', JSON.stringify([{ ...ITEM_SIMPLE, quantite: 1 }]));
    renderPanier();
    await waitFor(() => {
      expect(screen.getByText('Burger Classic')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText('Augmenter'));
    await waitFor(() => {
      // quantite 2 → 17,00 € (affiché dans la ligne item ET dans le total)
      expect(screen.getAllByText('17,00 €').length).toBeGreaterThan(0);
    });
  });

  it('bouton "Diminuer" à quantité 1 → item supprimé', async () => {
    localStorage.setItem('panier', JSON.stringify([{ ...ITEM_SIMPLE, quantite: 1 }]));
    renderPanier();
    await waitFor(() => {
      expect(screen.getByText('Burger Classic')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText('Diminuer'));
    await waitFor(() => {
      expect(screen.getByText(/votre panier est vide/i)).toBeInTheDocument();
    });
  });

  it('bouton "Supprimer" → item retiré du panier', async () => {
    localStorage.setItem('panier', JSON.stringify([ITEM_SIMPLE]));
    renderPanier();
    await waitFor(() => {
      expect(screen.getByText('Burger Classic')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/supprimer/i));
    await waitFor(() => {
      expect(screen.getByText(/votre panier est vide/i)).toBeInTheDocument();
    });
  });

  it('lien "Commander →" pointe vers /commande', async () => {
    localStorage.setItem('panier', JSON.stringify([ITEM_SIMPLE]));
    renderPanier();
    await waitFor(() => {
      const link = screen.getByRole('link', { name: /commander/i });
      expect(link).toHaveAttribute('href', '/commande');
    });
  });

  it('lien "Continuer mes achats" pointe vers /', async () => {
    localStorage.setItem('panier', JSON.stringify([ITEM_SIMPLE]));
    renderPanier();
    await waitFor(() => {
      const link = screen.getByRole('link', { name: /continuer mes achats/i });
      expect(link).toHaveAttribute('href', '/');
    });
  });
});

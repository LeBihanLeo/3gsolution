import { describe, it, expect, vi, beforeEach, afterEach, afterAll, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const mockItems = [
  { produitId: 'p1', nom: 'Burger', prix: 850, quantite: 1, options: [], imageUrl: undefined },
];

vi.mock('@/lib/cartContext', () => ({
  useCart: () => ({
    items: mockItems,
    totalPrice: 850,
    clearCart: vi.fn(),
  }),
}));

const server = setupServer(
  http.post('/api/checkout', () =>
    HttpResponse.json({ url: 'https://checkout.stripe.com/pay/test' })
  )
);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));

// Stub window.location avant chaque test pour éviter "Not implemented: navigation"
// et garantir que la mutation ne fuite pas entre tests.
beforeEach(() => vi.stubGlobal('location', { href: '' }));

afterEach(() => {
  server.resetHandlers();
  localStorage.clear();
  vi.unstubAllGlobals(); // restaure window.location réel
});

afterAll(() => server.close());

import FormulaireCommande from '@/components/client/FormulaireCommande';

function fillForm(nom = 'Jean Dupont', telephone = '0612345678') {
  // Les labels ne sont pas liés par htmlFor — on cible par name
  const nomInput = document.querySelector('input[name="nom"]') as HTMLInputElement;
  const telInput = document.querySelector('input[name="telephone"]') as HTMLInputElement;
  fireEvent.change(nomInput, { target: { value: nom } });
  fireEvent.change(telInput, { target: { value: telephone } });
}

describe('FormulaireCommande', () => {
  beforeEach(() => vi.clearAllMocks());

  it('affiche le récapitulatif avec les produits du panier', () => {
    render(<FormulaireCommande />);
    expect(screen.getByText(/burger/i)).toBeInTheDocument();
    // Plusieurs éléments avec ce prix (item + total) : vérifier qu'au moins un existe
    expect(screen.getAllByText('8,50 €').length).toBeGreaterThan(0);
  });

  it('submit sans nom → message d\'erreur Zod visible', async () => {
    render(<FormulaireCommande />);
    fireEvent.submit(screen.getByRole('button', { name: /payer/i }).closest('form')!);
    await waitFor(() => {
      expect(screen.getByText(/au moins 2 caractères/i)).toBeInTheDocument();
    });
  });

  it('téléphone format invalide → erreur Zod', async () => {
    render(<FormulaireCommande />);
    const nomInput = document.querySelector('input[name="nom"]') as HTMLInputElement;
    const telInput = document.querySelector('input[name="telephone"]') as HTMLInputElement;
    fireEvent.change(nomInput, { target: { value: 'Jean' } });
    fireEvent.change(telInput, { target: { value: '123' } }); // invalide
    fireEvent.submit(screen.getByRole('button', { name: /payer/i }).closest('form')!);
    await waitFor(() => {
      expect(screen.getByText(/numéro de téléphone invalide/i)).toBeInTheDocument();
    });
  });

  it('type retrait "Créneau programmé" → select créneaux visible', () => {
    render(<FormulaireCommande />);
    fireEvent.click(screen.getByLabelText(/créneau programmé/i));
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('type retrait "Dès que possible" → select créneaux absent', () => {
    render(<FormulaireCommande />);
    // Par défaut sur "immediat"
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('submit valide → POST /api/checkout déclenché', async () => {
    const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ url: 'https://checkout.stripe.com/pay/test' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(<FormulaireCommande />);
    fillForm();
    fireEvent.submit(document.querySelector('form')!);

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/checkout',
        expect.objectContaining({ method: 'POST' })
      )
    );

    mockFetch.mockRestore();
  });

  it('erreur réseau checkout → message d\'erreur affiché', async () => {
    server.use(
      http.post('/api/checkout', () => HttpResponse.error())
    );

    render(<FormulaireCommande />);
    fillForm();
    fireEvent.submit(screen.getByRole('button', { name: /payer/i }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/impossible de contacter/i)).toBeInTheDocument();
    });
  });

  it('checkbox "Mémoriser" cochée + submit → client_cache dans localStorage', async () => {
    server.use(
      http.post('/api/checkout', () =>
        HttpResponse.json({ url: 'https://checkout.stripe.com/pay/test' })
      )
    );

    render(<FormulaireCommande />);
    fillForm();
    const checkbox = screen.getByRole('checkbox', { name: /mémoriser/i });
    // .checked reflète l'état DOM courant (contrairement à getAttribute qui lit l'attribut HTML initial)
    if (!(checkbox as HTMLInputElement).checked) {
      fireEvent.click(checkbox);
    }
    fireEvent.submit(screen.getByRole('button', { name: /payer/i }).closest('form')!);

    await waitFor(() => {
      expect(localStorage.getItem('client_cache')).not.toBeNull();
    });
  });
});

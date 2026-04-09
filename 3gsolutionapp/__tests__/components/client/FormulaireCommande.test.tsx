import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

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

// TICK-070 — FormulaireCommande utilise useSession (Sprint 10)
// Mock renvoyant un client non connecté par défaut (état normal du formulaire invité)
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}));

import FormulaireCommande from '@/components/client/FormulaireCommande';

// SiteConfig par défaut : ouvert toute la journée
const defaultSiteConfigData = {
  horaireOuverture: '00:00',
  horaireFermeture: '23:59',
  fermeeAujourdhui: false,
};

function mockFetch(
  siteConfigOverride?: Partial<typeof defaultSiteConfigData>,
  checkoutStatus = 200,
  checkoutBody: unknown = { url: 'https://checkout.stripe.com/pay/test' }
) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes('/api/site-config')) {
      return new Response(
        JSON.stringify({ data: { ...defaultSiteConfigData, ...siteConfigOverride } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (url.includes('/api/checkout')) {
      if (checkoutStatus === 0) throw new TypeError('Failed to fetch');
      return new Response(JSON.stringify(checkoutBody), {
        status: checkoutStatus,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(null, { status: 404 });
  });
}

function fillForm(nom = 'Jean Dupont', telephone = '0612345678') {
  const nomInput = document.querySelector('input[name="nom"]') as HTMLInputElement;
  const telInput = document.querySelector('input[name="telephone"]') as HTMLInputElement;
  fireEvent.change(nomInput, { target: { value: nom } });
  fireEvent.change(telInput, { target: { value: telephone } });
}

async function waitForCreneaux() {
  await waitFor(() => {
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });
}

async function selectFirstCreneau() {
  const select = screen.getByRole('combobox');
  const options = select.querySelectorAll('option:not([value=""])');
  if (options.length > 0) {
    fireEvent.change(select, { target: { value: (options[0] as HTMLOptionElement).value } });
  }
}

describe('FormulaireCommande', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('location', { href: '' });
    mockFetch();
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('affiche le récapitulatif avec les produits du panier', () => {
    render(<FormulaireCommande />);
    expect(screen.getByText(/burger/i)).toBeInTheDocument();
    expect(screen.getAllByText('8,50 €').length).toBeGreaterThan(0);
  });

  it('submit sans nom → message d\'erreur Zod visible', async () => {
    render(<FormulaireCommande />);
    await waitForCreneaux();
    await selectFirstCreneau();
    fireEvent.submit(screen.getByRole('button', { name: /payer/i }).closest('form')!);
    await waitFor(() => {
      expect(screen.getByText(/au moins 2 caractères/i)).toBeInTheDocument();
    });
  });

  it('téléphone format invalide → erreur Zod', async () => {
    render(<FormulaireCommande />);
    await waitForCreneaux();
    const nomInput = document.querySelector('input[name="nom"]') as HTMLInputElement;
    const telInput = document.querySelector('input[name="telephone"]') as HTMLInputElement;
    fireEvent.change(nomInput, { target: { value: 'Jean' } });
    fireEvent.change(telInput, { target: { value: '123' } });
    fireEvent.submit(screen.getByRole('button', { name: /payer/i }).closest('form')!);
    await waitFor(() => {
      expect(screen.getByText(/numéro invalide/i)).toBeInTheDocument();
    });
  });

  it('select créneaux visible dès le chargement (plus de radio "Dès que possible")', async () => {
    render(<FormulaireCommande />);
    await waitForCreneaux();
    expect(screen.queryByText(/dès que possible/i)).not.toBeInTheDocument();
  });

  it('submit valide → POST /api/checkout déclenché', async () => {
    render(<FormulaireCommande />);
    await waitForCreneaux();
    fillForm();
    await selectFirstCreneau();
    fireEvent.submit(document.querySelector('form')!);

    await waitFor(() => {
      const spy = vi.mocked(globalThis.fetch);
      const checkoutCall = spy.mock.calls.find(([input]) =>
        String(input).includes('/api/checkout')
      );
      expect(checkoutCall).toBeDefined();
    });
  });

  it('erreur réseau checkout → message d\'erreur affiché', async () => {
    mockFetch(undefined, 0); // simule erreur réseau

    render(<FormulaireCommande />);
    await waitForCreneaux();
    fillForm();
    await selectFirstCreneau();
    fireEvent.submit(screen.getByRole('button', { name: /payer/i }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/impossible de contacter/i)).toBeInTheDocument();
    });
  });

  it('checkbox "Mémoriser" cochée + submit → client_cache dans localStorage', async () => {
    render(<FormulaireCommande />);
    await waitForCreneaux();
    fillForm();
    await selectFirstCreneau();

    const checkbox = screen.getByRole('checkbox', { name: /mémoriser/i });
    if (!(checkbox as HTMLInputElement).checked) {
      fireEvent.click(checkbox);
    }
    fireEvent.submit(screen.getByRole('button', { name: /payer/i }).closest('form')!);

    await waitFor(() => {
      expect(localStorage.getItem('client_cache')).not.toBeNull();
    });
  });

  it('boutique fermée manuellement → message affiché, bouton désactivé', async () => {
    mockFetch({ fermeeAujourdhui: true });

    render(<FormulaireCommande />);

    await waitFor(() => {
      expect(screen.getByText(/boutique est fermée/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /payer/i })).toBeDisabled();
  });
});

/**
 * TICK-116 — Tests ProfilButton
 * - Rendu uniquement si session.user.role === 'client'
 * - Position absolute top-4 right-4 dans le conteneur
 * - Navigation vers /profil au clic
 * - Accessible (aria-label)
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProfilButton from '@/components/client/ProfilButton';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// ── Mock useSession ───────────────────────────────────────────────────────────

const mockUseSession = vi.fn();
vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}));

beforeEach(() => vi.clearAllMocks());

describe('ProfilButton', () => {
  it('ne rend rien pendant le chargement de la session', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'loading' });
    const { container } = render(<ProfilButton />);
    expect(container.firstChild).toBeNull();
  });

  it('ne rend rien si l\'utilisateur n\'est pas connecté', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' });
    const { container } = render(<ProfilButton />);
    expect(container.firstChild).toBeNull();
  });

  it('ne rend rien si le rôle n\'est pas client (admin)', () => {
    mockUseSession.mockReturnValue({
      data: { user: { role: 'admin' } },
      status: 'authenticated',
    });
    const { container } = render(<ProfilButton />);
    expect(container.firstChild).toBeNull();
  });

  it('rend le bouton "Mon profil" pour un client authentifié', () => {
    mockUseSession.mockReturnValue({
      data: { user: { role: 'client' } },
      status: 'authenticated',
    });
    render(<ProfilButton />);
    expect(screen.getByRole('button', { name: /mon profil/i })).toBeTruthy();
  });

  it('navigue vers /profil au clic', () => {
    mockUseSession.mockReturnValue({
      data: { user: { role: 'client' } },
      status: 'authenticated',
    });
    render(<ProfilButton />);
    fireEvent.click(screen.getByRole('button', { name: /mon profil/i }));
    expect(mockPush).toHaveBeenCalledWith('/profil');
  });

  it('a l\'aria-label "Mon profil"', () => {
    mockUseSession.mockReturnValue({
      data: { user: { role: 'client' } },
      status: 'authenticated',
    });
    render(<ProfilButton />);
    expect(screen.getByRole('button', { name: 'Mon profil' })).toBeTruthy();
  });

  it('le wrapper a la classe absolute', () => {
    mockUseSession.mockReturnValue({
      data: { user: { role: 'client' } },
      status: 'authenticated',
    });
    const { container } = render(<ProfilButton />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper?.className).toMatch(/absolute/);
  });
});

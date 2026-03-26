// TICK-099 — Tests CommandeStepper
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import CommandeStepper from '@/components/client/CommandeStepper';

describe('CommandeStepper', () => {
  it('affiche les 4 étapes', () => {
    render(<CommandeStepper statut="payee" />);
    const list = screen.getByRole('list');
    const items = list.querySelectorAll('[role="listitem"]');
    expect(items).toHaveLength(4);
  });

  it('statut payee — étape 1 active, étapes 2-3-4 inactives', () => {
    render(<CommandeStepper statut="payee" />);
    const etape1 = screen.getByLabelText(/Confirmé.*étape actuelle/);
    expect(etape1).toBeInTheDocument();
    expect(screen.getByLabelText(/Préparation$/)).toBeInTheDocument();
  });

  it('statut en_preparation — étape 1 complète, étape 2 active', () => {
    render(<CommandeStepper statut="en_preparation" />);
    expect(screen.getByLabelText(/Confirmé.*terminé/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Préparation.*étape actuelle/)).toBeInTheDocument();
  });

  it('statut prete — étapes 1-2 complètes, étape 3 active', () => {
    render(<CommandeStepper statut="prete" />);
    expect(screen.getByLabelText(/Confirmé.*terminé/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Préparation.*terminé/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Prêt.*étape actuelle/)).toBeInTheDocument();
  });

  it('statut recuperee — toutes les étapes complètes sauf la dernière active', () => {
    render(<CommandeStepper statut="recuperee" />);
    expect(screen.getByLabelText(/Récupéré.*étape actuelle/)).toBeInTheDocument();
  });

  it('mode compact — labels de texte non affichés', () => {
    const { container } = render(<CommandeStepper statut="payee" compact />);
    // En compact, pas de span texte pour les labels
    expect(container.querySelector('span.mt-1')).not.toBeInTheDocument();
  });

  it('aria-label présent sur chaque étape', () => {
    render(<CommandeStepper statut="en_preparation" />);
    // Toutes les étapes ont un aria-label
    expect(screen.getByLabelText(/Confirmé/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Préparation/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Prêt/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Récupéré/)).toBeInTheDocument();
  });
});

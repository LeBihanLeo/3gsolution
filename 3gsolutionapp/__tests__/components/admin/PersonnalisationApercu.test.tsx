import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PersonnalisationApercu from '@/components/admin/PersonnalisationApercu';

describe('PersonnalisationApercu', () => {
  it('affiche le nom du restaurant dans l\'aperçu', () => {
    render(<PersonnalisationApercu nomRestaurant="Le Bistrot" banniereUrl="" />);
    expect(screen.getByText('Le Bistrot')).toBeInTheDocument();
  });

  it('banniereUrl absent → pas d\'attribut backgroundImage sur le hero', () => {
    const { container } = render(
      <PersonnalisationApercu nomRestaurant="Test" banniereUrl="" />
    );
    // Le fallback affiche l'emoji et le nom, pas de background-image
    expect(screen.getByText('Test')).toBeInTheDocument();
    const heroDiv = container.querySelector('[style*="backgroundImage"]');
    expect(heroDiv).not.toBeInTheDocument();
  });

  it('banniereUrl fourni → backgroundImage appliqué sur le div hero', () => {
    const { container } = render(
      <PersonnalisationApercu
        nomRestaurant="Le Bistrot"
        banniereUrl="https://example.com/banner.jpg"
      />
    );
    // Cibler précisément via data-testid pour éviter de sélectionner le mauvais div
    const hero = container.querySelector('[data-testid="hero"]') as HTMLElement;
    expect(hero).not.toBeNull();
    expect(hero.style.backgroundImage).toContain('example.com/banner.jpg');
  });

  it('nomRestaurant vide → affiche "Mon Restaurant" par défaut', () => {
    render(<PersonnalisationApercu nomRestaurant="" banniereUrl="" />);
    expect(screen.getByText('Mon Restaurant')).toBeInTheDocument();
  });
});

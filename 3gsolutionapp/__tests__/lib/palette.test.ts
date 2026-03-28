// TICK-122 — Tests unitaires generatePalette
import { describe, it, expect } from 'vitest';
import { generatePalette, SitePalette } from '@/lib/palette';

describe('generatePalette', () => {
  it('retourne les 6 tokens de palette', () => {
    const p = generatePalette('#E63946');
    const keys: (keyof SitePalette)[] = [
      'primary', 'primaryLight', 'primaryDark',
      'primaryForeground', 'surface', 'border',
    ];
    for (const k of keys) {
      expect(p[k]).toMatch(/^#[0-9a-fA-F]{6}$/i);
    }
  });

  it('conserve la couleur choisie dans primary', () => {
    expect(generatePalette('#E63946').primary).toBe('#E63946');
    expect(generatePalette('#457B9D').primary).toBe('#457B9D');
  });

  it('primaryForeground est blanc (#ffffff) sur couleur rouge foncé (contraste blanc > 4.5)', () => {
    // #B31B1B : luminance ≈ 0.105 → ratio blanc = 1.05/0.155 ≈ 6.8 > 4.5
    const p = generatePalette('#B31B1B');
    expect(p.primaryForeground).toBe('#ffffff');
  });

  it('primaryForeground est noir (#111111) sur couleur très claire', () => {
    const p = generatePalette('#F4F4F4'); // quasi-blanc → contraste blanc insuffisant
    expect(p.primaryForeground).toBe('#111111');
  });

  it('surface est suffisamment clair (luminosité ≥ 90% approximée)', () => {
    // surface hex → extrait la composante lumière : si R,G,B très hauts (≥ 220)
    const p = generatePalette('#E63946');
    const [r, g, b] = [
      parseInt(p.surface.slice(1, 3), 16),
      parseInt(p.surface.slice(3, 5), 16),
      parseInt(p.surface.slice(5, 7), 16),
    ];
    const avg = (r + g + b) / 3;
    expect(avg).toBeGreaterThan(220); // très clair
  });

  it('primaryDark est plus sombre que primary', () => {
    const p = generatePalette('#E63946');
    const lum = (hex: string) => {
      const [r, g, b] = [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16),
      ];
      return (r + g + b) / 3;
    };
    expect(lum(p.primaryDark)).toBeLessThan(lum(p.primary));
  });

  it('primaryLight est plus clair que primary', () => {
    const p = generatePalette('#E63946');
    const lum = (hex: string) => {
      const [r, g, b] = [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16),
      ];
      return (r + g + b) / 3;
    };
    expect(lum(p.primaryLight)).toBeGreaterThan(lum(p.primary));
  });

  it('fonctionne avec une couleur bleue foncée', () => {
    const p = generatePalette('#1a1a2e');
    expect(p.primary).toBe('#1a1a2e');
    expect(p.primaryForeground).toBe('#ffffff');
  });

  it('fonctionne avec une couleur noire', () => {
    const p = generatePalette('#000000');
    expect(p.primary).toBe('#000000');
    expect(p.primaryForeground).toBe('#ffffff');
  });
});

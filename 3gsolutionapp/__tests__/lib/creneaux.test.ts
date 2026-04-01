import { describe, it, expect, vi, afterEach } from 'vitest';
import { genererCreneaux, estDansPlageOuverture } from '@/lib/creneaux';
import { filtrerCreneauxDisponibles } from '@/components/client/FormulaireCommande';

describe('genererCreneaux', () => {
  it('génère 8 créneaux de 15 min entre 12:00 et 14:00', () => {
    const result = genererCreneaux('12:00', '14:00', 15);
    expect(result).toHaveLength(8);
    expect(result[0]).toBe('12:00 – 12:15');
    expect(result[7]).toBe('13:45 – 14:00');
  });

  it('génère 2 créneaux de 30 min sur 1 heure', () => {
    const result = genererCreneaux('12:00', '13:00', 30);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('12:00 – 12:30');
    expect(result[1]).toBe('12:30 – 13:00');
  });

  it('retourne un tableau vide si ouverture === fermeture', () => {
    expect(genererCreneaux('12:00', '12:00', 15)).toHaveLength(0);
  });

  it('retourne un tableau vide si le pas > plage totale', () => {
    expect(genererCreneaux('12:00', '12:10', 15)).toHaveLength(0);
  });

  it('gère la valeur limite 00:00 – 00:15 avec pas 15', () => {
    const result = genererCreneaux('00:00', '00:15', 15);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('00:00 – 00:15');
  });

  it('le dernier créneau se termine exactement à fermeture', () => {
    const result = genererCreneaux('11:00', '13:00', 20);
    const last = result[result.length - 1];
    const [, end] = last.split(' – ');
    expect(end).toBe('13:00');
  });

  it('formate correctement avec des zéros initiaux', () => {
    const result = genererCreneaux('09:00', '09:30', 15);
    expect(result[0]).toBe('09:00 – 09:15');
    expect(result[1]).toBe('09:15 – 09:30');
  });
});

// TICK-101 — filtrerCreneauxDisponibles (buffer 30 min)
describe('filtrerCreneauxDisponibles', () => {
  it('filtre les créneaux dont le début est dans le passé', () => {
    // Créneaux fictifs dans le futur lointain → tous conservés
    const future = ['23:00 – 23:15', '23:15 – 23:30'];
    expect(filtrerCreneauxDisponibles(future, 30)).toHaveLength(2);
  });

  it('exclut les créneaux trop proches (buffer)', () => {
    // Créneaux dont le début est 00:00 → passé garanti → filtrés
    const past = ['00:00 – 00:15', '00:15 – 00:30'];
    const result = filtrerCreneauxDisponibles(past, 30);
    expect(result).toHaveLength(0);
  });

  it('retourne tableau vide si input vide', () => {
    expect(filtrerCreneauxDisponibles([], 30)).toHaveLength(0);
  });

  it('ignore les créneaux au format invalide', () => {
    expect(filtrerCreneauxDisponibles(['invalide'], 30)).toHaveLength(0);
  });
});

// estDansPlageOuverture
describe('estDansPlageOuverture', () => {
  afterEach(() => vi.useRealTimers());

  it('retourne false si fermeeAujourdhui = true', () => {
    expect(estDansPlageOuverture('08:00', '22:00', true)).toBe(false);
  });

  it('retourne true si heure courante est dans la plage', () => {
    // Fixer l'heure à 12:00
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T12:00:00'));
    expect(estDansPlageOuverture('11:30', '14:00', false)).toBe(true);
  });

  it('retourne false si heure courante est avant ouverture', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T10:00:00'));
    expect(estDansPlageOuverture('11:30', '14:00', false)).toBe(false);
  });

  it('retourne false si heure courante est après fermeture', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T15:00:00'));
    expect(estDansPlageOuverture('11:30', '14:00', false)).toBe(false);
  });

  it('retourne false exactement à l\'heure de fermeture (borne exclue)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T14:00:00'));
    expect(estDansPlageOuverture('11:30', '14:00', false)).toBe(false);
  });

  it('retourne true exactement à l\'heure d\'ouverture (borne incluse)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T11:30:00'));
    expect(estDansPlageOuverture('11:30', '14:00', false)).toBe(true);
  });
});

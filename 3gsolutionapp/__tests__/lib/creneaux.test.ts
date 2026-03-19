import { describe, it, expect } from 'vitest';
import { genererCreneaux } from '@/lib/creneaux';

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

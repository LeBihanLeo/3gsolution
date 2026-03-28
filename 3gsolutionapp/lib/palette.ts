// TICK-122 — Génération de palette couleur depuis une couleur principale hex
// Entrée : hex (#RRGGBB), Sortie : 6 tokens CSS

export interface SitePalette {
  primary: string;            // couleur choisie
  primaryLight: string;       // teinte +40% luminosité (fonds, survols légers)
  primaryDark: string;        // teinte -30% luminosité (hover boutons, focus)
  primaryForeground: string;  // #fff ou #111 selon contraste WCAG AA sur primary
  surface: string;            // très clair, quasi-blanc teinté (fonds de cartes)
  border: string;             // teinte moyennement saturée (séparateurs, bordures)
}

// ─── Conversions ────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  const sl = s / 100;
  const ll = l / 100;
  const a = sl * Math.min(ll, 1 - ll);
  const f = (n: number): string => {
    const k = (n + h / 30) % 12;
    const color = ll - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return '#' + f(0) + f(8) + f(4);
}

// ─── Contraste WCAG ─────────────────────────────────────────────────────────

function toLinear(c: number): number {
  const n = c / 255;
  return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// ─── Génération palette ──────────────────────────────────────────────────────

export function generatePalette(hex: string): SitePalette {
  const [h, s, l] = hexToHsl(hex);

  const primary = hex;

  // +40% luminosité, saturation légèrement réduite, max 93%
  const primaryLight = hslToHex(h, Math.max(s - 10, 15), Math.min(l + 40, 93));

  // -30% luminosité, min 8%
  const primaryDark = hslToHex(h, s, Math.max(l - 30, 8));

  // WCAG AA : blanc (#fff) si ratio ≥ 4.5, sinon noir (#111)
  const primaryForeground = contrastRatio(primary, '#ffffff') >= 4.5 ? '#ffffff' : '#111111';

  // Surface : très clair, luminosité forcée à 95%, saturation réduite
  const surface = hslToHex(h, Math.max(s - 30, 5), 95);

  // Border : luminosité +20%, saturation réduite
  const border = hslToHex(h, Math.max(s - 15, 20), Math.min(l + 20, 85));

  return { primary, primaryLight, primaryDark, primaryForeground, surface, border };
}

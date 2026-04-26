export const PRODUIT_CATEGORIES = [
  'Entrées',
  'Plats',
  'Desserts',
  'Boissons',
  'Formules',
] as const;

export type ProduitCategorie = typeof PRODUIT_CATEGORIES[number];

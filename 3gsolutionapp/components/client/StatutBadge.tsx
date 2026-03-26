// Composant partagé — badge pill statut commande
// Utilisé dans /confirmation et dans HistoriqueCommandes

export const STATUT_BADGE_CONFIG: Record<string, { label: string; cls: string; dotCls: string }> = {
  en_attente_paiement: { label: 'En attente',     cls: 'bg-gray-100 text-gray-500',  dotCls: 'bg-gray-400' },
  payee:               { label: 'Confirmée',       cls: 'bg-brand-light text-brand',  dotCls: 'bg-brand' },
  en_preparation:      { label: 'En préparation',  cls: 'bg-brand-light text-brand',  dotCls: 'bg-brand' },
  prete:               { label: 'Prête !',         cls: 'bg-green-50 text-green-700', dotCls: 'bg-green-500' },
  recuperee:           { label: 'Récupérée',       cls: 'bg-gray-100 text-gray-500',  dotCls: 'bg-gray-400' },
};

interface StatutBadgeProps {
  statut: string;
  /** "md" (défaut) = légèrement plus grand, pour les pages standalone ; "sm" = compact, pour les cards */
  size?: 'sm' | 'md';
}

export function StatutBadge({ statut, size = 'md' }: StatutBadgeProps) {
  const cfg = STATUT_BADGE_CONFIG[statut] ?? STATUT_BADGE_CONFIG['payee'];
  const padding  = size === 'sm' ? 'px-2.5 py-0.5' : 'px-3 py-1';
  const dotSize  = size === 'sm' ? 'w-1.5 h-1.5'   : 'w-2 h-2';

  return (
    <span className={`inline-flex items-center gap-1.5 ${padding} rounded-full text-xs font-semibold ${cfg.cls}`}>
      <span className={`${dotSize} rounded-full flex-shrink-0 ${cfg.dotCls}`} aria-hidden="true" />
      {cfg.label}
    </span>
  );
}

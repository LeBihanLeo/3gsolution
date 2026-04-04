// Composant partagé — emoji visuel du statut commande
// Utilisé dans /confirmation et dans HistoriqueCommandes

const STATUT_EMOJI: Record<string, { emoji: string; label: string }> = {
  payee:          { emoji: '📨', label: 'Commande confirmée' },
  en_preparation: { emoji: '🍔', label: 'En préparation' },
  prete:          { emoji: '✅', label: 'Prête à récupérer' },
  recuperee:      { emoji: '😋', label: 'Récupérée' },
  remboursee:     { emoji: '↩️', label: 'Remboursée' },
};

interface StatutEmojiProps {
  statut: string;
  /** Taille Tailwind, ex: "text-5xl" (défaut) ou "text-4xl" */
  size?: string;
}

export function StatutEmoji({ statut, size = 'text-5xl' }: StatutEmojiProps) {
  const cfg = STATUT_EMOJI[statut] ?? STATUT_EMOJI['payee'];
  return (
    // key sur l'emoji : React remonte le span à chaque changement → rejoue l'animation
    <span
      key={cfg.emoji}
      className={`${size} leading-none select-none inline-block`}
      style={{ animation: 'emoji-swap 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both' }}
      role="img"
      aria-label={cfg.label}
    >
      {cfg.emoji}
    </span>
  );
}

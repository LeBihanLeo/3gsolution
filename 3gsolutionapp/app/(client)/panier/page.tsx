// TICK-088 — BackLink retour vers le menu
import Panier from '@/components/client/Panier';
import { BackLink } from '@/components/ui';

export const metadata = { title: 'Votre panier — 3G Solution' };

export default function PanierPage() {
  return (
    <>
      <div className="mb-4">
        <BackLink href="/" label="Retour vers le menu" />
      </div>
      <Panier />
    </>
  );
}

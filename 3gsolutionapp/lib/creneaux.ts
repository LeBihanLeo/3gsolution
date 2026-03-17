/**
 * Génère une liste de créneaux horaires de la forme "HH:MM – HH:MM".
 *
 * @param ouverture  Heure d'ouverture au format "HH:MM" (ex: "12:00")
 * @param fermeture  Heure de fermeture au format "HH:MM" (ex: "14:00")
 * @param pas        Durée d'un créneau en minutes (ex: 15)
 * @returns          Tableau de chaînes "12:00 – 12:15", "12:15 – 12:30", …
 */
export function genererCreneaux(
  ouverture: string,
  fermeture: string,
  pas: number
): string[] {
  const [hO, mO] = ouverture.split(':').map(Number);
  const [hF, mF] = fermeture.split(':').map(Number);

  const debutMin = hO * 60 + mO;
  const finMin = hF * 60 + mF;

  const fmt = (mins: number) =>
    `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

  const creneaux: string[] = [];
  for (let start = debutMin; start + pas <= finMin; start += pas) {
    creneaux.push(`${fmt(start)} – ${fmt(start + pas)}`);
  }
  return creneaux;
}

/** Crée la liste des créneaux à partir des variables d'environnement (NEXT_PUBLIC_). */
export function creneauxDepuisEnv(): string[] {
  const ouverture = process.env.NEXT_PUBLIC_RESTAURANT_OUVERTURE ?? '12:00';
  const fermeture = process.env.NEXT_PUBLIC_RESTAURANT_FERMETURE ?? '14:00';
  const pas = parseInt(process.env.NEXT_PUBLIC_RESTAURANT_PAS_MINUTES ?? '15', 10);
  return genererCreneaux(ouverture, fermeture, pas);
}

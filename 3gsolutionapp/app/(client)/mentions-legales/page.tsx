// TICK-056 — Mise à jour section cookies (bouton Refuser ajouté)
// TICK-057 — Mise à jour durée de rétention (12 mois) + droit à l'effacement
// TICK-058 — Ajout section sous-traitants (RGPD Art. 28 et Art. 44)
import Link from 'next/link';

export default function MentionsLegalesPage() {
  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mentions légales</h1>

      <section className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Éditeur du site</h2>
        <p className="text-sm text-gray-600">
          <strong>3G Solution</strong><br />
          Adresse : [à compléter]<br />
          Téléphone : [à compléter]<br />
          Email : [à compléter]
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Hébergement</h2>
        <p className="text-sm text-gray-600">
          Ce site est hébergé par :<br />
          <strong>Vercel Inc.</strong><br />
          340 Pine Street, Suite 701, San Francisco, CA 94104, USA<br />
          <a
            href="https://vercel.com/legal/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            vercel.com
          </a>
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Données personnelles collectées</h2>
        <p className="text-sm text-gray-600 mb-2">
          Dans le cadre de la passation de commandes, nous collectons les données suivantes :
        </p>
        <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1">
          <li>Nom et prénom</li>
          <li>Numéro de téléphone</li>
          <li>Adresse email (optionnelle, utilisée uniquement pour l&apos;envoi de confirmation de commande)</li>
          <li>Détail de la commande et créneau de retrait</li>
        </ul>
        <p className="text-sm text-gray-600 mt-2">
          Les données de paiement (carte bancaire) sont traitées exclusivement par{' '}
          <strong>Stripe</strong> et ne transitent pas par nos serveurs.
        </p>
      </section>

      {/* TICK-057 — Durée de rétention mise à jour : 12 mois (conformité obligation comptable) */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Durée de conservation</h2>
        <p className="text-sm text-gray-600">
          Les données de commandes (nom, téléphone, email) sont conservées pour une durée
          maximale de <strong>12 mois</strong> à compter de la date de la commande, conformément
          aux obligations légales de comptabilité (Art. L123-22 du Code de commerce).
          L&apos;adresse email n&apos;est utilisée que pour l&apos;envoi de la confirmation et n&apos;est pas
          conservée à des fins marketing.
        </p>
        <p className="text-sm text-gray-600 mt-2">
          Passé ce délai, les informations personnelles sont automatiquement anonymisées.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Vos droits (RGPD)</h2>
        <p className="text-sm text-gray-600">
          Conformément au Règlement Général sur la Protection des Données (RGPD), vous
          disposez des droits suivants :
        </p>
        <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1 mt-2">
          <li>Droit d&apos;accès à vos données personnelles</li>
          <li>Droit de rectification</li>
          <li>Droit à l&apos;effacement (&laquo; droit à l&apos;oubli &raquo;)</li>
          <li>Droit à la limitation du traitement</li>
          <li>Droit à la portabilité</li>
        </ul>
        <p className="text-sm text-gray-600 mt-2">
          Pour exercer ces droits, contactez-nous à l&apos;adresse :{' '}
          <strong>[email de contact à compléter]</strong>
        </p>
      </section>

      {/* TICK-056 — Section cookies mise à jour (bouton Refuser disponible) */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Cookies</h2>
        <p className="text-sm text-gray-600 mb-2">
          Ce site utilise un <strong>cookie de session strictement nécessaire</strong> pour
          l&apos;authentification de l&apos;espace administrateur. Ce cookie est exempté de
          consentement au sens de la délibération CNIL n° 2020-091, car il est indispensable
          au fonctionnement du service.
        </p>
        <p className="text-sm text-gray-600">
          Aucun cookie de tracking, publicitaire ou analytique n&apos;est utilisé. Vous pouvez
          cliquer sur &laquo; Refuser &raquo; dans le bandeau sans impact sur votre expérience de
          commande.
        </p>
      </section>

      {/* TICK-040 — Section cache localStorage RGPD */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Données stockées localement</h2>
        <p className="text-sm text-gray-600 mb-2">
          Si vous avez coché &laquo; Mémoriser mes informations &raquo; sur le formulaire de commande,
          votre nom, numéro de téléphone et adresse email (si fourni) sont enregistrés dans le
          stockage local de votre navigateur (<strong>localStorage</strong>) sur cet appareil
          uniquement.
        </p>
        <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1 mb-2">
          <li>Ces données <strong>ne sont jamais transmises à nos serveurs</strong> depuis le cache.</li>
          <li>Elles servent uniquement à pré-remplir le formulaire lors de votre prochaine commande.</li>
          <li>Elles restent sur votre appareil jusqu&apos;à ce que vous les supprimiez manuellement.</li>
        </ul>
        <p className="text-sm text-gray-600">
          Pour supprimer ces données, rendez-vous sur la page de commande et cliquez sur
          &laquo; Effacer mes informations &raquo;, ou videz le stockage local de votre navigateur
          depuis les paramètres de confidentialité.
        </p>
      </section>

      {/* TICK-058 — Sous-traitants (RGPD Art. 28 et Art. 44) */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Sous-traitants et transferts hors UE</h2>
        <p className="text-sm text-gray-600 mb-3">
          Conformément à l&apos;article 28 du RGPD, nous faisons appel aux sous-traitants suivants.
          Ces entreprises sont basées aux États-Unis et encadrent leurs transferts de données
          par des garanties appropriées (Data Privacy Framework ou clauses contractuelles types) :
        </p>
        <div className="space-y-3">
          <div className="text-sm text-gray-600 border-l-2 border-gray-200 pl-3">
            <p className="font-medium">Stripe Inc. — Paiement en ligne</p>
            <p>Données transmises : informations de commande (nom, email) dans les métadonnées de session Checkout.</p>
            <p>Stripe est signataire du <strong>Data Privacy Framework UE-USA</strong> (transfert légalement encadré).</p>
            <a
              href="https://stripe.com/fr/legal/stripe-data-privacy-framework"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Politique de confidentialité Stripe
            </a>
          </div>
          <div className="text-sm text-gray-600 border-l-2 border-gray-200 pl-3">
            <p className="font-medium">Vercel Inc. — Hébergement</p>
            <p>Données transmises : toutes les requêtes HTTP (logs serveur), données de commande.</p>
            <a
              href="https://vercel.com/legal/dpa"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              DPA Vercel
            </a>
          </div>
          <div className="text-sm text-gray-600 border-l-2 border-gray-200 pl-3">
            <p className="font-medium">MongoDB Atlas (MongoDB Inc.) — Base de données</p>
            <p>Données stockées : commandes, produits, configuration du site.</p>
            <a
              href="https://www.mongodb.com/legal/dpa"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              DPA MongoDB
            </a>
          </div>
          <div className="text-sm text-gray-600 border-l-2 border-gray-200 pl-3">
            <p className="font-medium">Resend Inc. — Emails transactionnels</p>
            <p>Données transmises : email et nom du client pour l&apos;envoi de la confirmation de commande et des liens de réinitialisation de mot de passe.</p>
            <a
              href="https://resend.com/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Politique de confidentialité Resend
            </a>
          </div>
          <div className="text-sm text-gray-600 border-l-2 border-gray-200 pl-3">
            <p className="font-medium">Google LLC — Authentification (connexion avec Google)</p>
            <p>Si vous choisissez de vous connecter via Google, votre email et identifiant Google sont transmis à nos serveurs lors de la connexion. Aucune donnée Google n&apos;est partagée à des tiers. Ce service est optionnel.</p>
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Politique de confidentialité Google
            </a>
          </div>
        </div>
      </section>

      {/* Compte client */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Compte client</h2>
        <p className="text-sm text-gray-600 mb-2">
          La création d&apos;un compte client est <strong>facultative</strong>. Elle vous permet
          de consulter l&apos;historique de vos commandes et de bénéficier de futures offres.
        </p>
        <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1 mb-2">
          <li>Données collectées : adresse email (obligatoire), nom (optionnel).</li>
          <li>Mot de passe stocké sous forme de hachage bcrypt — jamais en clair.</li>
          <li>Tokens de réinitialisation de mot de passe : hachés SHA-256, valables <strong>1 heure</strong>, à usage unique.</li>
          <li>Durée de conservation : <strong>36 mois</strong> après la dernière connexion (fenêtre glissante). Le compte est supprimé automatiquement après cette période d&apos;inactivité.</li>
        </ul>
        <p className="text-sm text-gray-600">
          Vous pouvez supprimer votre compte à tout moment depuis votre espace &laquo; Mon compte &raquo;.
          Cette action anonymise vos commandes passées et supprime vos données personnelles (RGPD Art. 17).
        </p>
      </section>

      <Link href="/" className="text-sm text-blue-600 hover:underline">
        ← Retour au menu
      </Link>
    </div>
  );
}

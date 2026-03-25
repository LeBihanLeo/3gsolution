// TICK-056 — Mise à jour section cookies (bouton Refuser ajouté)
// TICK-057 — Mise à jour durée de rétention (12 mois) + droit à l'effacement
// TICK-058 — Ajout section sous-traitants (RGPD Art. 28 et Art. 44)
// TICK-079 — Compte client + Google OAuth + sécurité mot de passe
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

      {/* TICK-079 — Compte client */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Compte client</h2>
        <p className="text-sm text-gray-600 mb-2">
          Si vous créez un compte, nous collectons et traitons les données suivantes :
        </p>
        <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1 mb-2">
          <li>Adresse email (identifiant de connexion)</li>
          <li>Nom affiché</li>
          <li>Historique de vos commandes passées</li>
          <li>Méthode de connexion : identifiants propres ou connexion Google</li>
        </ul>
        <p className="text-sm text-gray-600 mb-1">
          <strong>Base légale :</strong> exécution du contrat (Art. 6(1)(b) du RGPD) — le traitement
          est nécessaire à la gestion de votre compte et de vos commandes.
        </p>
        <p className="text-sm text-gray-600 mb-1">
          <strong>Durée de conservation :</strong> vos données de compte sont conservées pendant toute
          la durée de vie de votre compte. En cas de suppression de compte, toutes vos données
          personnelles sont définitivement effacées.
        </p>
        <p className="text-sm text-gray-600">
          <strong>Droit à l&apos;effacement :</strong> vous pouvez supprimer votre compte à tout moment
          depuis la section &laquo; Zone danger &raquo; de votre{' '}
          <Link href="/profil" className="text-blue-600 hover:underline">profil</Link>.
          Cette action est irréversible et entraîne la suppression immédiate de vos données.
        </p>
      </section>

      {/* TICK-079 — Connexion sociale (Google OAuth) */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Connexion avec Google</h2>
        <p className="text-sm text-gray-600">
          Si vous choisissez de vous connecter via Google (OAuth 2.0), Google partage avec notre
          application votre <strong>adresse email</strong> et votre <strong>nom Google</strong>.
          Aucune autre donnée Google n&apos;est transmise ni stockée. Vous pouvez révoquer cet
          accès à tout moment depuis votre compte Google (
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            myaccount.google.com/permissions
          </a>
          ).
        </p>
      </section>

      {/* TICK-079 — Sécurité du mot de passe */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Sécurité du mot de passe</h2>
        <p className="text-sm text-gray-600 mb-2">
          Si vous créez un compte avec des identifiants propres, votre mot de passe doit respecter
          les exigences suivantes :
        </p>
        <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1">
          <li>8 caractères minimum</li>
          <li>Au moins une lettre majuscule</li>
          <li>Au moins un chiffre</li>
          <li>Au moins un caractère spécial</li>
        </ul>
        <p className="text-sm text-gray-600 mt-2">
          Votre mot de passe est chiffré via bcrypt avant stockage — il n&apos;est jamais stocké en clair.
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
          <li>Droit à l&apos;effacement (&laquo; droit à l&apos;oubli &raquo;) — exercez-le depuis votre{' '}
            <Link href="/profil" className="text-blue-600 hover:underline">profil</Link> (suppression de compte)</li>
          <li>Droit à la limitation du traitement</li>
          <li>Droit à la portabilité — téléchargez vos données depuis votre{' '}
            <Link href="/profil" className="text-blue-600 hover:underline">profil</Link> (bouton &laquo; Télécharger mes données &raquo;)</li>
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
            <p>Données transmises : email et nom du client pour l&apos;envoi de la confirmation de commande.</p>
            <a
              href="https://resend.com/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Politique de confidentialité Resend
            </a>
          </div>
          {/* TICK-079 — Google LLC (Google OAuth) */}
          <div className="text-sm text-gray-600 border-l-2 border-gray-200 pl-3">
            <p className="font-medium">Google LLC — Connexion sociale (Google OAuth)</p>
            <p>Données transmises : adresse email et nom Google lors de la connexion via Google.</p>
            <p>Localisation : États-Unis. Garantie de transfert : Standard Contractual Clauses (SCC)
              conformément au RGPD Art. 46.</p>
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

      <Link href="/" className="text-sm text-blue-600 hover:underline">
        ← Retour au menu
      </Link>
    </div>
  );
}

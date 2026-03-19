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
            href="https://vercel.com"
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

      <section className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Durée de conservation</h2>
        <p className="text-sm text-gray-600">
          Les données de commandes sont conservées pour une durée maximale de 3 ans à compter
          de la date de la commande, conformément aux obligations légales de comptabilité.
          L&apos;adresse email n&apos;est utilisée que pour l&apos;envoi de la confirmation et n&apos;est pas
          conservée à des fins marketing.
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

      <section className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Cookies</h2>
        <p className="text-sm text-gray-600">
          Ce site utilise uniquement un cookie de session pour l&apos;authentification de l&apos;espace
          administrateur. Aucun cookie de tracking ou publicitaire n&apos;est utilisé.
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

      <Link href="/" className="text-sm text-blue-600 hover:underline">
        ← Retour au menu
      </Link>
    </div>
  );
}

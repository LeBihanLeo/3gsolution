# Onboarding restaurant — 3G Solution

Guide opérationnel pour ajouter un nouveau restaurant sur la plateforme multi-tenant.

---

## A — Google Console (une seule fois pour toute la plateforme)

Ces étapes sont faites **une fois** lors du premier déploiement. Elles ne se répètent pas pour chaque restaurant.

- [ ] Créer un projet OAuth sur [console.cloud.google.com](https://console.cloud.google.com)
- [ ] Activer l'API "Google Identity" (OAuth 2.0)
- [ ] Ajouter l'URI de redirection autorisée : `https://app.3gsolution.com/api/auth/callback/google`
  - ⚠️ **C'est la seule URI à enregistrer** — tous les restaurants utilisent ce hub
- [ ] Copier `Client ID` → variable Vercel `GOOGLE_CLIENT_ID`
- [ ] Copier `Client Secret` → variable Vercel `GOOGLE_CLIENT_SECRET`

---

## B — Par restaurant (lors de chaque onboarding)

### 1. Créer l'entrée Restaurant (super-admin)

- [ ] Se connecter sur `https://app.3gsolution.com/superadmin`
- [ ] Créer un nouveau restaurant via `/superadmin/nouveau` :
  - `nomRestaurant` : nom affiché dans l'app
  - `domaine` : `resto-a.com` (sans `https://`, sans `www`)
  - `adminEmail` + mot de passe admin
  - Clés Stripe (publishable, secret, webhook secret)
- [ ] Copier l'`_id` MongoDB retourné (utile pour le débogage)

### 2. Ajouter le domaine custom sur Vercel

- [ ] Aller dans Vercel Dashboard → projet → Settings → Domains
- [ ] Cliquer "Add Domain" et entrer `resto-a.com`
- [ ] Vercel affiche les instructions DNS à configurer

### 3. Configurer le DNS chez le registrar du restaurant

- [ ] Ajouter un enregistrement CNAME :
  ```
  resto-a.com  CNAME  cname.vercel-dns.com
  ```
  (ou les valeurs exactes indiquées par Vercel)
- [ ] Vérifier la propagation DNS : `nslookup resto-a.com` ou [dnschecker.org](https://dnschecker.org)
  - La propagation prend de quelques minutes à 48h selon le TTL du registrar
- [ ] Vercel provisionne automatiquement le certificat SSL (1-5 minutes après propagation)

### 4. Configurer le webhook Stripe

- [ ] Sur [dashboard.stripe.com](https://dashboard.stripe.com) → Developers → Webhooks
- [ ] Ajouter un endpoint : `https://resto-a.com/api/webhook/stripe`
- [ ] Événements à écouter : `checkout.session.completed`, `checkout.session.expired`
- [ ] Copier le **Webhook Secret** (`whsec_...`) et le saisir dans le super-admin pour ce restaurant

### 5. Tests de recette

- [ ] `https://resto-a.com` → le menu du restaurant s'affiche (tenant résolu correctement)
- [ ] Flow Google login sur `https://resto-a.com` :
  - Clic "Continuer avec Google" → redirection vers `app.3gsolution.com`
  - Authentification Google → retour sur `resto-a.com` → session créée
- [ ] Vérifier que `restaurantId` dans la session correspond au restaurant `resto-a.com`
- [ ] Checkout Stripe : `success_url` pointe vers `https://resto-a.com/confirmation`
- [ ] Test commande complète : panier → paiement → confirmation

---

## Dépannage

### Le menu ne s'affiche pas / erreur 500 "tenant non résolu"
- Vérifier que `domaine` dans la DB correspond **exactement** au Host header (sans port, sans `www`)
- Vérifier `DEV_TENANT_ID` en développement local
- Vérifier l'Edge Config Vercel si activé : le domaine doit y être synchronisé

### SSL en attente ("Waiting for domain to resolve")
- La propagation DNS n'est pas encore terminée — patienter et revérifier dans 30 min
- Vérifier que le CNAME pointe bien vers `cname.vercel-dns.com` (pas une IP)

### Flow Google → erreur "Domaine non autorisé"
- Le champ `domaine` dans la DB doit correspondre au `window.location.origin` du restaurant
- Exemple : si le restaurant est sur `www.resto-a.com`, le champ `domaine` doit être `www.resto-a.com`

### Le webhook Stripe ne déclenche pas les commandes
- Vérifier que le Webhook Secret dans la DB du restaurant correspond à celui de Stripe Dashboard
- Vérifier les logs Stripe Dashboard → "Webhook attempts" pour voir les erreurs 4xx/5xx
- En développement, utiliser `stripe listen --forward-to localhost:3000/api/webhook/stripe`

### AuthCode expiré ("Code invalide ou expiré")
- Le TTL est de 30s — si le navigateur est lent ou si la propagation DNS est longue, le code peut expirer
- Le client peut simplement recliquer "Continuer avec Google" pour relancer le flow

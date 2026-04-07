# Architecture MVP — Plateforme de commande en ligne

## Stack technique

| Couche          | Technologie               | Justification                              |
|-----------------|---------------------------|--------------------------------------------|
| Frontend        | Next.js 14 (App Router)   | SSR/SSG, API Routes intégrées, PWA facile  |
| Styling         | Tailwind CSS              | Rapide, pas de dépendances lourdes         |
| Base de données | MongoDB Atlas             | Schéma flexible, hosted, gratuit en MVP    |
| ODM             | Mongoose                  | Modélisation claire, validations           |
| Paiement        | Stripe (Checkout)         | Sécurisé, aucune CB stockée                |
| Email           | Resend (ou Nodemailer)    | Simple, fiable, gratuit en faible volume   |
| Auth admin      | NextAuth.js (credentials) | Simple, pas d'OAuth tiers requis           |
| Hébergement     | Vercel                    | Déploiement Next.js natif, HTTPS auto      |
| PWA             | next-pwa                  | Manifest + service worker minimal          |
| Stockage images | Vercel Blob               | CDN global, URLs permanentes, gratuit MVP  |

---

## Structure des dossiers

```
3G_Solution/
├── app/
│   ├── (client)/
│   │   ├── page.tsx               # Menu principal
│   │   ├── panier/page.tsx        # Panier
│   │   ├── commande/page.tsx               # Formulaire commande (nom, tel, créneau)
│   │   ├── confirmation/page.tsx          # Page post-paiement
│   │   ├── profil/page.tsx                # Profil client + historique commandes (max 3)
│   │   ├── profil/commandes/page.tsx      # Historique complet timeline par mois — Sprint 12 TICK-098
│   │   ├── auth/
│   │   │   ├── login/page.tsx     # Connexion (Google + email/mdp + invité)
│   │   │   ├── register/page.tsx  # Inscription (credentials)
│   │   │   ├── verify-email/page.tsx
│   │   │   ├── forgot-password/page.tsx
│   │   │   └── reset-password/page.tsx
│   │   └── layout.tsx
│   ├── (admin)/
│   │   ├── login/page.tsx
│   │   ├── page.tsx               # Dashboard admin — KPIs + 4 dernières commandes — Sprint 13 TICK-103
│   │   ├── commandes/page.tsx     # Liste commandes + statuts + section récupérées + export CSV
│   │   ├── menu/page.tsx          # Gestion produits (vue client avec boutons management — TICK-102)
│   │   ├── personnalisation/page.tsx  # Bannière, nom, couleur principale, horaires — layout side-by-side (Sprint 16 TICK-118)
│   │   └── layout.tsx             # Auth guard
│   └── api/
│       ├── produits/
│       │   ├── route.ts           # GET liste, POST création (admin)
│       │   └── [id]/route.ts      # PUT, DELETE (admin)
│       ├── commandes/
│       │   ├── route.ts           # GET (admin)
│       │   └── [id]/
│       │       └── statut/route.ts # PATCH statut (admin)
│       ├── checkout/
│       │   └── route.ts           # Création session Stripe
│       ├── upload/
│       │   └── route.ts           # POST upload image (Vercel Blob ou fallback local)
│       ├── site-config/
│       │   └── route.ts           # GET public / PUT admin (personnalisation)
│       ├── webhooks/
│       │   └── stripe/route.ts    # Validation paiement Stripe
│       ├── admin/
│       │   └── commandes/
│       │       └── export/route.ts    # GET export CSV commandes (admin, comptabilité) — Sprint 13 TICK-106
│       └── client/
│           ├── register/route.ts      # POST inscription
│           ├── verify-email/route.ts  # POST vérification token
│           ├── forgot-password/route.ts # POST demande reset mdp
│           ├── reset-password/route.ts  # POST nouveau mdp
│           ├── profil/route.ts        # PATCH mise à jour nom
│           ├── account/route.ts       # DELETE suppression compte (RGPD)
│           ├── commandes/route.ts     # GET historique commandes (enCours + passees)
│           └── export/route.ts        # GET export données RGPD (Art. 20)
├── components/
│   ├── ui/
│   │   ├── Button.tsx                 # Composant bouton unifié — bordure + texte + contraste (Sprint 10.2)
│   │   └── BackLink.tsx               # Flèche retour avec texte cliquable (Sprint 10.2)
│   ├── client/
│   │   ├── MenuCard.tsx
│   │   ├── Panier.tsx
│   │   ├── FormulaireCommande.tsx
│   │   ├── HeaderAuth.tsx             # Header auth (connexion uniquement) — Sprint 10 · bouton "Mon profil" déplacé dans <main> au Sprint 15 (TICK-116)
│   │   ├── HistoriqueCommandes.tsx    # Historique commandes profil — Sprint 10.2
│   │   ├── CommandeStepper.tsx        # Stepper 4 étapes statut commande — Sprint 12 TICK-099
│   │   └── CommandeSuiviModal.tsx     # Modale détail commande en cours — Sprint 12 TICK-097
│   └── admin/
│       ├── CommandeRow.tsx
│       ├── ProduitForm.tsx
│       ├── PersonnalisationApercu.tsx  # Aperçu temps réel vitrine
│       └── DropZone.tsx               # Upload drag & drop réutilisable
├── lib/
│   ├── mongodb.ts                 # Connexion Mongoose (singleton)
│   ├── stripe.ts                  # Client Stripe
│   ├── email.ts                   # Envoi email confirmation
│   ├── auth.ts                    # Config NextAuth
│   ├── blob.ts                    # Helper Vercel Blob (upload)
│   ├── ratelimit.ts               # TICK-052 — Rate limiting login (Upstash/in-memory)
│   ├── logger.ts                  # TICK-059 — Logs de sécurité structurés (JSON prod)
│   └── palette.ts                 # TICK-122 — Génération palette couleur depuis couleurPrincipale (hex → SitePalette)
├── models/
│   ├── Produit.ts
│   ├── Commande.ts
│   └── SiteConfig.ts          # Config vitrine (singleton)
├── public/
│   ├── manifest.json              # PWA manifest
│   ├── icons/
│   └── uploads/                   # Fallback dev upload local (gitignored)
├── next.config.js                 # Config PWA
└── .env.local
```

---

## Modèles de données (MongoDB / Mongoose)

### Restaurant *(nouveau — Sprint 18 TICK-131)*

> Remplace `SiteConfig` (singleton). Chaque document représente un tenant (un restaurant) identifié par son domaine.

```typescript
{
  _id: ObjectId,
  slug: string,                  // "resto-a" — identifiant URL interne, unique
  domaine: string,               // "www.restoA.com" — index unique, résolution tenant
  domainesAlternatifs?: string[], // ["restoA.com"] — alias www/apex

  // Config vitrine (anciennement SiteConfig)
  nomRestaurant: string,
  banniereUrl?: string,
  couleurPrincipale: string,     // hex ex: "#E63946"
  horaireOuverture: string,      // "HH:MM", défaut "11:30"
  horaireFermeture: string,      // "HH:MM", défaut "14:00"
  fermeeAujourdhui: boolean,     // toggle manuel, défaut false

  // Auth admin (remplace ADMIN_EMAIL / ADMIN_PASSWORD_HASH env)
  adminEmail: string,            // unique par restaurant
  adminPasswordHash: string,     // bcrypt hash — jamais exposé en API

  // Stripe (par restaurant — champs select: false par défaut)
  stripeSecretKey: string,           // sk_live_... — jamais exposé en API
  stripeWebhookSecret: string,       // whsec_... — jamais exposé en API
  stripePublishableKey: string,      // pk_live_... — exposé via GET /api/site-config

  emailFrom?: string,            // ex: "commandes@restoA.com" — fallback sur env global si absent

  createdAt: Date,
  updatedAt: Date
}
```

> **Index :** `domaine` (unique), `slug` (unique), `adminEmail` (unique).
> `fermeeAujourdhui` est un toggle manuel — non réinitialisé automatiquement à minuit.
> `stripeSecretKey` et `stripeWebhookSecret` sont marqués `select: false` — jamais retournés par les requêtes Mongoose sans `.select('+stripeSecretKey')` explicite.

### SiteConfig *(deprecated — Sprint 18 TICK-135)*

> Remplacé par `Restaurant`. Conservé temporairement pour la migration. Sera supprimé après validation du Sprint 18.

### Produit

```typescript
{
  _id: ObjectId,
  restaurantId: ObjectId,  // référence Restaurant — requis, indexé — Sprint 18 TICK-133
  nom: string,             // "Burger Classic"
  description: string,
  categorie: string,       // "Burgers", "Boissons", etc.
  prix: number,            // en centimes, toujours TTC (ex: 850 = 8,50€)
  taux_tva: 0 | 5.5 | 10 | 20, // taux TVA applicable — défaut 10 (restauration standard) — Sprint 17 TICK-126
  options: [               // suppléments
    { nom: string, prix: number }
  ],
  imageUrl?: string,       // URL Vercel Blob (optionnel)
  actif: boolean,
  createdAt: Date
}
```

---

### Client

```typescript
{
  _id: ObjectId,
  email: string,                    // unique, indexé
  nom: string,                      // obligatoire — éditable par le client (rendu obligatoire Sprint 10.2)
  passwordHash?: string,            // null pour les comptes Google
  provider: "credentials" | "google",
  emailVerified: boolean,           // false jusqu'à confirmation par email
  emailVerifyToken?: string,        // token brut valide 24h (crypto.randomBytes)
  emailVerifyTokenExpiry?: Date,
  passwordResetToken?: string,      // token brut valide 1h, usage unique
  passwordResetTokenExpiry?: Date,
  role: "client",
  createdAt: Date,
  updatedAt: Date
}
```

> **RGPD :** Document supprimé **immédiatement** lors de la suppression de compte (pas de `purgeAt`). Les `Commande` associées sont anonymisées (même mécanique que TICK-057).

---

### Commande

```typescript
{
  _id: ObjectId,
  stripeSessionId: string,     // pour webhook
  statut: "en_attente_paiement" | "payee" | "en_preparation" | "prete" | "recuperee",
  // Cycle de vie : en_attente_paiement → payee → en_preparation → prete → recuperee
  // Transitions admin (TICK-099) : payee→en_preparation, en_preparation→prete, prete→recuperee
  client: {
    nom: string,
    telephone: string,
    email?: string             // pour confirmation mail
  },
  retrait: {
    type: "immediat" | "creneau",
    creneau?: string           // ex: "12h30"
  },
  produits: [
    {
      produitId: ObjectId,
      nom: string,             // snapshot au moment de la commande
      prix: number,            // TTC, en centimes
      quantite: number,
      taux_tva: number,        // snapshot du taux TVA au moment de la commande — Sprint 17 TICK-129
      options: [{ nom: string, prix: number }]
    }
  ],
  commentaire?: string,
  total: number,               // en centimes
  clientId?: ObjectId,         // référence Client — null pour commandes invité (TICK-075)
  restaurantId: ObjectId,      // référence Restaurant — requis, indexé — Sprint 18 TICK-134
  purgeAt: Date,               // TICK-057 — RGPD Art. 5(1)(e) : createdAt + 12 mois
  createdAt: Date
}
```

> **RGPD (TICK-057) :** `purgeAt` est calculé à `createdAt + 12 mois` (obligation comptable légale). L'admin peut anonymiser les PII d'une commande `"prete"` via `DELETE /api/commandes/[id]` — le document est conservé, seuls nom/téléphone/email sont remplacés par `[Supprimé]`.

---

## Flux principal (côté client)

```
[Page /]
  ├── Session active (role: client) → [Menu]
  └── Pas de session :
        ├── [Se connecter] → /auth/login → [Menu]
        └── [Continuer en tant qu'invité] → [Menu]

[Menu] → [Panier] → [Formulaire] → [Checkout Stripe]
                                         ↓
                              [Webhook Stripe reçu]
                                         ↓
                         [Statut commande → "payée"]
                         [Email confirmation envoyé]
                                         ↓
                              [Page Confirmation]
```

**Important :** Le panier est stocké en `localStorage` (côté client uniquement).
La commande n'est créée en base qu'après confirmation du webhook Stripe,
pas avant, pour éviter les commandes fantômes.

Le menu (`/`) est masqué tant que l'utilisateur n'a pas choisi son mode (connecté ou invité). Si une session client est déjà active, le choix est sauté et le menu s'affiche directement.

---

## API Routes

| Méthode | Route                        | Rôle                                        | Auth   |
|---------|------------------------------|---------------------------------------------|--------|
| GET     | /api/produits                | Liste produits actifs                       | Public |
| POST    | /api/produits                | Créer produit                               | Admin  |
| PUT     | /api/produits/[id]           | Modifier produit                            | Admin  |
| PATCH   | /api/produits/[id]           | Activer/désactiver                          | Admin  |
| DELETE  | /api/produits/[id]           | Supprimer produit                           | Admin  |
| GET     | /api/commandes               | Liste commandes (admin)                     | Admin  |
| DELETE  | /api/commandes/[id]          | Anonymiser les PII (RGPD Art. 17)           | Admin  |
| POST    | /api/checkout                | Crée session Stripe (prix vérifiés en BDD)  | Public |
| POST    | /api/webhooks/stripe         | Confirme paiement, envoie email             | Stripe |
| PATCH   | /api/commandes/[id]/statut   | Marquer comme "prête"                       | Admin  |
| GET     | /api/commandes/suivi         | Suivi commande public (sans PII)            | Public |
| GET     | /api/site-config             | Lire la config vitrine                      | Public |
| PUT     | /api/site-config             | Mettre à jour la config vitrine             | Admin  |
| POST    | /api/upload                  | Upload image (magic bytes + UUID filename)  | Admin  |
| POST    | /api/client/register         | Créer un compte client                      | Public |
| POST    | /api/client/verify-email     | Confirmer le token de vérification email    | Public |
| POST    | /api/client/forgot-password  | Envoyer l'email de reset de mot de passe    | Public |
| POST    | /api/client/reset-password   | Appliquer le nouveau mot de passe           | Public |
| PATCH   | /api/client/profil           | Mettre à jour le nom du client              | Client |
| DELETE  | /api/client/account          | Supprimer le compte et anonymiser (RGPD)    | Client |
| GET     | /api/client/commandes        | Historique des commandes du client          | Client |
| GET     | /api/client/export           | Export de toutes les données (RGPD Art. 20) | Client |
| GET     | /api/admin/commandes/export  | Export CSV commandes (comptabilité)         | Admin  |

---

## Paiement Stripe — Flux détaillé

1. Client clique "Payer" → POST `/api/checkout`
2. Serveur crée une `Stripe Checkout Session` avec les produits
3. Client redirigé vers Stripe Checkout (page Stripe hébergée)
4. Après paiement : Stripe redirige vers `/confirmation?session_id=xxx`
5. **En parallèle** : Stripe envoie webhook `checkout.session.completed`
6. Webhook → crée la commande en base + envoie email
7. Page confirmation affiche le récapitulatif via `session_id`

```
Variables d'env requises :
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
```

---

## Authentification Admin

- **NextAuth.js** avec provider `Credentials`
- 1 seul compte admin (email + mot de passe hashé en env)
- Session JWT (stateless, pas de table sessions)
- Middleware Next.js protège les routes admin et applique le rate limiting login

> **Extension Sprint 10 :** L'instance NextAuth est étendue avec un provider `Google` et un second provider `Credentials` pour les clients. Un champ `role: "admin" | "client"` est injecté dans le JWT via le callback `jwt`. Les routes admin vérifient `token.role === "admin"` — un client connecté ne peut pas accéder à l'administration.

**Routes protégées par le middleware (TICK-052, TICK-054, TICK-072) :**

| Routes | Protection |
|--------|-----------|
| `/admin/commandes/*`, `/admin/menu/*`, `/admin/personnalisation/*` | Token JWT requis + `role === "admin"` |
| `/api/commandes`, `/api/commandes/:id/statut` | Token JWT requis + `role === "admin"` |
| `/api/upload`, `/api/site-config`, `/api/produits`, `/api/produits/:id` | Token JWT requis + `role === "admin"` (défense en profondeur) |
| `/api/auth/callback/credentials` | Rate limiting 10 req / 15 min par IP |
| `/profil` | Token JWT requis (`role === "client"`) |
| `/api/client/profil`, `/api/client/account`, `/api/client/commandes` | Token JWT requis (`role === "client"`) |
| `/api/client/register`, `/api/client/forgot-password` | Rate limiting 5 req / 15 min par IP |

**Routes protégées par le middleware — ajouts Sprint 18 (TICK-132, TICK-136) :**

| Routes | Protection |
|--------|-----------|
| `/superadmin/*`, `/api/superadmin/*` | Token JWT `role === "superadmin"` (credentials maîtres env) |

> **Multi-tenant (TICK-136) :** Le middleware vérifie également que `token.restaurantId` correspond au `x-tenant-id` résolu pour les tokens admin. Un admin de restoA ne peut pas accéder aux routes admin de restoB.

**Routes publiques intentionnelles :** `GET /api/produits`, `GET /api/site-config`, `GET /api/commandes/suivi`, `POST /api/checkout`, `POST /api/webhooks/stripe`, `POST /api/client/verify-email`, `POST /api/client/reset-password`

```
Variables d'env :
# Sprint 18 : ADMIN_EMAIL et ADMIN_PASSWORD_HASH supprimés (credentials par restaurant en base)
NEXTAUTH_SECRET
# Super-admin (gestionnaire de la plateforme)
SUPERADMIN_EMAIL
SUPERADMIN_PASSWORD_HASH   # bcrypt hash
SUPERADMIN_JWT_SECRET
# Rate limiting (TICK-052) — plan gratuit Upstash Redis
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

---

## Architecture Multi-Tenant *(Sprint 18)*

### Vue d'ensemble

```
www.restoA.com ──┐
www.restoB.com ──┤──→ Vercel (un seul déploiement Next.js)
www.restoC.com ──┘         │
                            ▼
                     middleware.ts
                     ┌─────────────────────────────┐
                     │ 1. Lire Host header           │
                     │ 2. Lookup Restaurant.domaine  │
                     │ 3. Injecter x-tenant-id       │
                     └─────────────┬───────────────┘
                                   │ x-tenant-id: ObjectId
                          ┌────────┴────────┐
                          ▼                 ▼
                   Server Components    API Routes
                   (layout.tsx)         (produits, commandes...)
                          │                 │
                          └────────┬────────┘
                                   ▼
                          MongoDB (base partagée)
                          ├── Restaurant (config + auth)
                          ├── Produit (+ restaurantId)
                          ├── Commande (+ restaurantId)
                          └── Client (global, partagé)
```

### Isolation des données

| Collection | Isolation | Mécanisme |
|-----------|-----------|-----------|
| `Restaurant` | N/A | Un document = un tenant |
| `Produit` | Par tenant | Champ `restaurantId` indexé, filtré sur toutes les requêtes |
| `Commande` | Par tenant | Champ `restaurantId` indexé, filtré sur toutes les requêtes |
| `Client` | **Global** | Comptes partagés inter-restaurants (login unique) |

### Résolution du tenant (`lib/tenant.ts`)

```typescript
// Lit x-tenant-id depuis les headers Next.js (injecté par middleware)
export function getTenantId(headers: Headers): mongoose.Types.ObjectId

// Cache middleware : Map<domaine, { restaurantId, expiry }> — TTL 60 s
// Évite une requête DB sur chaque requête HTTP
```

### Stripe multi-tenant (`lib/stripe.ts`)

```typescript
// Factory avec cache — un client Stripe par restaurant
export async function getStripeClient(restaurantId: string): Promise<Stripe>

// Clé publique exposée via GET /api/site-config (champ stripePublishableKey)
// Clés secrètes stockées avec select: false — jamais retournées par défaut
```

### Zones d'administration

| Zone | URL | Accès | Périmètre |
|------|-----|-------|-----------|
| Admin restaurant | `/admin/*` | Credentials du `Restaurant` | Menu, commandes, personnalisation d'un restaurant |
| Super-admin | `/superadmin/*` | Credentials env (`SUPERADMIN_*`) | Création/gestion de tous les restaurants |

### Onboarding d'un nouveau restaurant

**Étape 1 — Créer le tenant (super-admin)**
1. Aller sur `/superadmin/nouveau`
2. Renseigner : nom du restaurant, slug, domaine principal (`www.restoA.com`), email admin, mot de passe admin, clés Stripe (`pk_live_...`, `sk_live_...`, `whsec_...`)

**Étape 2 — Ajouter le domaine sur Vercel**
1. Vercel Dashboard → Project → Settings → Domains
2. Ajouter `www.restoA.com` et `restoA.com` (redirect vers www)
3. Vercel génère automatiquement les certificats SSL

**Étape 3 — Configurer le DNS chez le registrar**
```
Type    Nom     Valeur
CNAME   www     cname.vercel-dns.com
A       @       76.76.21.21  (IP Vercel — vérifier dans le dashboard)
```

**Étape 4 — Enregistrer le webhook Stripe**
1. Dans le dashboard Stripe du restaurant
2. Créer un endpoint webhook : `https://www.restoA.com/api/webhooks/stripe`
3. Événements à sélectionner : `checkout.session.completed`, `charge.refunded`, `charge.dispute.created`, `charge.failed`
4. Copier le `whsec_...` généré dans le champ `stripeWebhookSecret` via le super-admin

**Étape 5 — Vérification**
- [ ] `https://www.restoA.com` → affiche le menu du bon restaurant (nom + bannière + palette)
- [ ] `https://www.restoA.com/admin/login` → connexion avec les credentials du restaurant
- [ ] Commande test → confirmation email reçu → webhook Stripe `checkout.session.completed` OK
- [ ] `https://www.restoA.com/admin` → commande visible dans le dashboard admin

**Développement local — Seed restaurant**

```bash
# Crée un restaurant par défaut avec domaine "localhost:3000"
# Lit ADMIN_EMAIL, ADMIN_PASSWORD, STRIPE_* depuis .env.local
npx tsx scripts/seed-restaurant.ts

# Génération d'un hash bcrypt (pour SUPERADMIN_PASSWORD_HASH)
npx tsx scripts/generate-hash.ts <mot_de_passe>
```

Le script est idempotent : relancé sur un restaurant existant, il ne fait rien.

---

## PWA

- `next-pwa` configuré en `next.config.js`
- `manifest.json` : nom, icônes, `display: standalone`, `background_color`
- Service worker : cache statique uniquement (app online-only, pas d'offline)
- Installable sur mobile (Android/iOS)

---

## Email de confirmation

Service recommandé : **Resend** (gratuit jusqu'à 3 000 emails/mois)

Contenu de l'email :
- Récapitulatif commande (produits, total)
- Créneau de retrait
- Numéro de commande

Envoyé depuis le webhook Stripe (source de vérité = paiement confirmé).

---

## Refresh admin (sans WebSocket)

- Polling auto toutes les **10 secondes** sur `/api/commandes` (page commandes)
- Polling toutes les **30 secondes** sur le dashboard admin (TICK-103)
- Implémenté avec `setInterval` + `useEffect` dans les composants admin

---

## Sprint 13 — Dashboard Admin & Gestion Avancée (2026-03-26)

### SiteConfig étendu (TICK-100, TICK-105)

```typescript
{
  horaireOuverture: string,      // "HH:MM" ex: "11:30" — défaut "11:30"
  horaireFermeture: string,      // "HH:MM" ex: "14:00" — défaut "14:00"
  fermeeAujourdhui: boolean,     // toggle manuel — non réinitialisé automatiquement
}
```

> `fermeeAujourdhui: true` → checkout bloqué (503) + bandeau client + formulaire disabled.

### Créneaux dynamiques (TICK-101)

`FormulaireCommande` charge les horaires depuis `GET /api/site-config` et filtre les créneaux dont le début est `> now + 10 min`. `filtrerCreneauxDisponibles()` est exportée et testée unitairement.

### Admin menu — vue cartes (TICK-102)

`app/admin/(protected)/menu/page.tsx` : grille de cartes style client avec boutons Modifier / Activer-Désactiver / Supprimer. Groupement par catégorie préservé. Modale confirmation avant suppression.

### Dashboard admin (TICK-103)

`app/admin/(protected)/page.tsx` : 4 KPIs (commandes du jour, CA, en cours, récupérées) + 4 dernières commandes en cours + 3 cards navigation rapide. Polling 30 s.

### Transitions commandes complètes (TICK-099, TICK-104)

`CommandeRow` refactorisé avec `onAdvance(id, statut)` générique. Transitions visibles :

| Statut actuel | Bouton | → Statut |
|---|---|---|
| `payee` | En préparation → | `en_preparation` |
| `en_preparation` | Prête → | `prete` |
| `prete` | Récupérée ✓ | `recuperee` |

Section "Récupérées aujourd'hui" en bas de page commandes.

### Export CSV comptabilité (TICK-106)

`GET /api/admin/commandes/export?from=YYYY-MM-DD&to=YYYY-MM-DD` — auth admin.
- TVA 10% incluse : `TVA = round(TTC / 11)`
- UTF-8 BOM (`\uFEFF`), séparateur `;`, compatible Excel FR
- Log `commandes_exported_csv` via `lib/logger.ts`

### Middleware — nouvelles routes protégées (TICK-103, TICK-106)

| Route | Protection |
|---|---|
| `/admin/` (dashboard) | Token JWT + `role === "admin"` |
| `GET /api/admin/commandes/export` | Token JWT + `role === "admin"` |

---

## Sécurité & RGPD (Sprint 8 — audit 2026-03-20 / Sprint 9 — correctifs 2026-03-20)

| Point | Implémentation | Ticket |
|-------|---------------|--------|
| HTTPS | Vercel (automatique, certificat Let's Encrypt) | — |
| Données bancaires | Jamais stockées (tout via Stripe) | — |
| **Validation des prix** | Prix rechargés depuis MongoDB — valeurs client ignorées | TICK-050 |
| **Headers HTTP** | CSP dynamique (sans `unsafe-eval` en prod), X-Frame-Options, nosniff, Referrer-Policy | TICK-051, TICK-061 |
| **Rate limiting login** | 10 req / 15 min / IP — Upstash prod, in-memory dev, fail-safe sur panne Redis | TICK-052, TICK-063 |
| **Validation MIME upload** | Magic bytes via `file-type` — nom de fichier remplacé par UUID | TICK-053 |
| **Middleware étendu** | Toutes routes admin couvertes + `/api/commandes/:id` + IP non-spoofable | TICK-054, TICK-062 |
| **Mock checkout** | Double guard `NODE_ENV + STRIPE_SECRET_KEY`, TTL 30 min sur sessions | TICK-055 |
| **Webhook Stripe** | Signature `constructEvent` + idempotence + validation Zod des métadonnées | —, TICK-064 |
| Auth admin | Middleware NextAuth, JWT, bcrypt | — |
| Variables sensibles | `.env.local` jamais committé (`.gitignore`) | — |
| **Bandeau cookie CNIL** | Boutons "Refuser" et "Accepter" de même visibilité | TICK-056 |
| **Rétention données** | `purgeAt = createdAt + 12 mois` ; index TTL MongoDB ; anonymisation PII via DELETE admin | TICK-057, TICK-060 |
| **Accountability RGPD** | Anonymisations loggées (`commande_anonymisee`) via `lib/logger.ts` | TICK-060 |
| **Sous-traitants RGPD** | Stripe, Vercel, MongoDB, Resend documentés dans `/mentions-legales` | TICK-058 |
| **Logs structurés** | `lib/logger.ts` — JSON en prod, lisible en dev ; tous les handlers utilisent le logger | TICK-059, TICK-064 |

---

## Variables d'environnement

> **Sprint 18 — Multi-tenant :** Les variables `STRIPE_*`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` sont supprimées. Elles sont désormais stockées **par restaurant** dans la collection `Restaurant` en base. Seules les variables globales de plateforme restent en env.

```env
# MongoDB
MONGODB_URI=mongodb+srv://...

# NextAuth (global — un seul secret pour toute la plateforme)
NEXTAUTH_URL=https://www.restoA.com  # URL de base pour le callback OAuth (doit correspondre au domaine principal)
NEXTAUTH_SECRET=...

# Super-admin — gestionnaire de la plateforme 3G Solution (Sprint 18 TICK-138)
SUPERADMIN_EMAIL=admin@3gsolution.fr
SUPERADMIN_PASSWORD_HASH=$2b$10$...   # bcrypt hash
SUPERADMIN_JWT_SECRET=...             # secret JWT dédié super-admin

# Email global (Resend) — utilisé si emailFrom absent sur le Restaurant
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@3gsolution.fr

# Vercel Blob (images) — partagé entre tous les restaurants
# Optionnel en développement : si absent, les uploads sont sauvegardés dans public/uploads/
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...

# Rate limiting login — TICK-052 (Upstash Redis, plan gratuit)
# Optionnel : si absent, fallback in-memory (développement uniquement)
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...

# Google OAuth — compte client (Sprint 10) — global, partagé entre restaurants
# Créer les credentials sur console.cloud.google.com
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
```

> **Variables supprimées en Sprint 18 :** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` — toutes stockées par restaurant dans `models/Restaurant.ts`.
>
> **Développement local :** Le script `scripts/seed-restaurant.ts` crée un restaurant seed avec domaine `localhost:3000` incluant des clés Stripe de test, permettant de travailler sans super-admin.

---

## Périmètre MVP

| Module              | Complexité | Pages / Endpoints  |
|---------------------|------------|--------------------|
| Menu client         | Faible     | 1 page, 1 GET      |
| Panier              | Faible     | localStorage       |
| Formulaire commande | Faible     | 1 page             |
| Paiement Stripe     | Moyenne    | 1 POST + 1 webhook |
| Confirmation        | Faible     | 1 page             |
| Admin commandes     | Faible     | 1 page, 2 routes   |
| Admin menu          | Faible     | 1 page, 4 routes   |
| Auth admin          | Faible     | NextAuth config    |
| Email               | Faible     | 1 fonction         |
| Personnalisation    | Faible     | 1 page admin, 2 routes |
| **Total**           |            | ~9 pages, ~12 API  |

---

## Dépendances principales

> Versions réelles installées au 2026-03-19.

```json
{
  "dependencies": {
    "next": "16.1.7",
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "mongoose": "^8.23.0",
    "stripe": "^20.4.1",
    "next-auth": "^4.24.13",
    "bcryptjs": "^2.4.3",
    "@types/bcryptjs": "^2.4.6",
    "resend": "^3.5.0",
    "tailwindcss": "^4",
    "zod": "^3.25.76",
    "@vercel/blob": "^0",
    "@ducanh2912/next-pwa": "^10.2.9",
    "file-type": "^latest",
    "@upstash/ratelimit": "^latest",
    "@upstash/redis": "^latest"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@tailwindcss/postcss": "^4",
    "eslint": "^9",
    "eslint-config-next": "16.1.7"
  }
}
```

> **Note PWA :** `@ducanh2912/next-pwa` remplace `next-pwa` (incompatible Turbopack). La PWA est implémentée manuellement via `public/sw.js` + composant `SwRegister.tsx`.

> **Tests (Sprint 7) :** Vitest, Testing Library, MSW, mongodb-memory-server sont en devDependencies.

> **Sécurité (Sprint 8) :** `file-type` valide les uploads par magic bytes. `@upstash/ratelimit` + `@upstash/redis` implémentent le rate limiting login (prod). Les deux packages Upstash nécessitent `UPSTASH_REDIS_REST_URL` et `UPSTASH_REDIS_REST_TOKEN` — en l'absence de ces variables, un fallback in-memory s'active automatiquement (développement uniquement).

---

## Images produits & Bannière

### Stratégie de stockage

La route `POST /api/upload` adopte une stratégie à deux modes selon l'environnement :

```
BLOB_READ_WRITE_TOKEN présent (production) ?
  ├── OUI → @vercel/blob : CDN global, URLs HTTPS permanentes
  │          retourne https://<store>.public.blob.vercel-storage.com/<uuid>.<ext>
  └── NON → Fallback local (développement) :
             sauvegarde dans public/uploads/<uuid>.<ext>
             retourne /uploads/<uuid>.<ext>
             public/uploads/ est dans .gitignore
```

Les validations (type MIME, taille 5 Mo, auth admin) s'appliquent dans les deux modes.

### Points clés

- Le modèle `Produit` expose un champ `imageUrl?` optionnel.
- Le modèle `SiteConfig` conserve son champ `banniereUrl` — désormais alimenté par upload plutôt que par saisie manuelle d'URL.
- Le composant `DropZone` est réutilisé pour les deux cas d'usage (produit et bannière).
- Le domaine `*.public.blob.vercel-storage.com` est ajouté dans `next.config.ts` → `images.remotePatterns` pour que `next/image` accepte les URLs Blob. Les URLs locales (`/uploads/...`) sont nativement acceptées.
- `imageUrl: null` dans un PUT supprime l'image du produit en base (champ MongoDB mis à `null`, ignoré à l'affichage).

---

## Stratégie de tests

### Stack de test

| Outil | Rôle |
|-------|------|
| `vitest` | Runner de tests (remplace Jest — natif ESM/TypeScript, compatible Next.js) |
| `@testing-library/react` | Rendu et assertions sur les composants React |
| `@testing-library/user-event` | Simulation réaliste des interactions clavier/souris |
| `@testing-library/jest-dom` | Matchers DOM étendus (`toBeInTheDocument`, `toHaveValue`, etc.) |
| `msw` (Mock Service Worker) | Interception des appels `fetch` dans les tests composants |
| `mongodb-memory-server` | Base MongoDB in-memory pour les tests de modèles Mongoose |
| `@vitest/coverage-v8` | Rapport de couverture (HTML + lcov) |

### Organisation des tests

```
__tests__/
├── helpers/
│   └── mongoMemory.ts         # Setup/teardown mongodb-memory-server partagé
├── lib/
│   └── creneaux.test.ts       # Tests fonctions pures
├── models/
│   ├── Produit.test.ts
│   ├── Commande.test.ts
│   └── SiteConfig.test.ts
├── api/
│   ├── produits.test.ts
│   ├── produits-id.test.ts
│   ├── commandes.test.ts
│   ├── commandes-statut.test.ts
│   ├── commandes-suivi.test.ts
│   ├── checkout.test.ts
│   ├── webhook-stripe.test.ts
│   ├── site-config.test.ts
│   └── upload.test.ts
└── components/
    ├── client/
    │   ├── MenuCard.test.tsx
    │   ├── Panier.test.tsx
    │   ├── FormulaireCommande.test.tsx
    │   └── ConfirmationSuivi.test.tsx
    └── admin/
        ├── CommandeRow.test.tsx
        ├── ProduitForm.test.tsx
        ├── DropZone.test.tsx
        └── PersonnalisationApercu.test.tsx
__mocks__/
├── next/
│   └── navigation.ts          # Mock useRouter, useSearchParams, usePathname
└── next-auth/
    └── react.ts               # Mock useSession, signIn, signOut
```

### Périmètre et couverture cible

| Couche | Type de test | Cible couverture |
|--------|-------------|-----------------|
| `lib/creneaux.ts` | Unitaire (fonctions pures) | 100 % |
| Schémas Zod | Unitaire | 100 % |
| `models/` | Intégration (MongoDB in-memory) | 90 % |
| `app/api/` | Unitaire (handlers mockés) | 70 % |
| `components/` | Composant (RTL + MSW) | 70 % |

> **Non couvert volontairement :** `lib/mongodb.ts` (connexion réelle), `lib/stripe.ts` (SDK tiers), pages Next.js entières (couvert par TICK-023 E2E).

### Conventions de mock

- **Mongoose** : chaque test de route API mock le modèle via `vi.mock('../../models/Produit')` — jamais la vraie base.
- **`getServerSession`** : mocké via `vi.mock('next-auth')` pour retourner `null` (non-auth) ou un objet session admin.
- **Stripe** : mocké via `vi.mock('stripe')` ; `constructEvent` retourne un objet événement synthétique.
- **`@vercel/blob`** : mocké via `vi.mock('@vercel/blob')` ; `put` retourne `{ url: 'https://blob.vercel-storage.com/test.jpg' }`.
- **`file-type`** : mocké via `vi.mock('file-type')` (package ESM v19+ incompatible avec les fichiers synthétiques sans magic bytes) ; `fileTypeFromBuffer` retourne `{ mime: 'image/jpeg', ext: 'jpg' }` pour une image valide, `undefined` pour un type non reconnu (→ 400).
- **`connectDB` + modèles dans les routes post-TICK-050** : les routes qui rechargent les prix depuis MongoDB (`/api/checkout`) nécessitent `vi.mock('@/lib/mongodb', () => ({ connectDB: vi.fn() }))` et un mock du modèle Produit. Utiliser **`vi.hoisted()`** pour déclarer la fonction mock avant le hoist de `vi.mock` : `const { mockFind } = vi.hoisted(() => ({ mockFind: vi.fn() }))` ; ne jamais référencer une variable `const` déclarée après `vi.mock` dans sa factory (erreur d'initialisation au hoist).
- **`localStorage`** : réinitialisé via `localStorage.clear()` dans `afterEach`.
- **Timers** : `vi.useFakeTimers()` pour tester le polling (`setInterval`) sans attente réelle.
- **`window.location`** : stubbé via `vi.stubGlobal('location', { href: '' })` dans `beforeEach` dès qu'un test déclenche une redirection ; restauré via `vi.unstubAllGlobals()` dans `afterEach`. Ne pas utiliser `Object.defineProperty(window, 'location', ...)` directement (mutation globale sans cleanup possible).
- **Variables d'environnement** : stubbées via `vi.stubEnv(...)` dans `beforeEach` ; restaurées via `vi.unstubAllEnvs()` dans `afterEach` pour éviter toute fuite entre tests.
- **`Object.defineProperty` sur éléments DOM** : toujours passer `configurable: true` pour permettre la redéfinition lors d'exécutions successives (ex : `input.files`).
- **État DOM ciblé** : utiliser `data-testid` pour cibler les éléments avec style inline (ex : `data-testid="hero"` sur le div bannière de `PersonnalisationApercu`). Éviter les traversées `querySelectorAll` + `find` sur le style.
- **MongoDB in-memory** : `mongoMemory.ts` inclut un guard `mongoose.disconnect()` dans `connect()` pour gérer les configurations Vitest non-standard (`singleFork`). En mode par défaut (pool `threads`), chaque fichier de test a son propre worker isolé.

---

## Cache client (localStorage) — Conformité RGPD

Le formulaire de commande peut mémoriser le nom, téléphone et email du client en `localStorage` pour faciliter les commandes suivantes.

**Clé localStorage :** `client_cache` → `{ nom, telephone, email? }` (JSON)

**Règles RGPD appliquées :**
- Consentement explicite via checkbox non cochée par défaut
- Information claire affichée sous la checkbox
- Bouton "Effacer mes informations" accessible à tout moment (visible uniquement si cache existant)
- Aucune donnée envoyée à nos serveurs depuis le cache
- Mention dédiée dans la page `/mentions-legales` (section "Données stockées localement")

**Détail d'implémentation :**
- Lecture du cache via `useEffect` + `useRef` (champs non-contrôlés) pour éviter les erreurs SSR
- Sauvegarde uniquement au submit, pas en temps réel
- Si checkbox décochée au submit → cache supprimé (`localStorage.removeItem`)

---

## Numéro de commande (preuve de commande)

Chaque commande MongoDB possède un `_id` ObjectId. Les 6 derniers caractères en majuscules servent de **numéro court** affiché à la fois côté admin et côté client.

- **Admin** (`CommandeRow`) : badge `#XXXXXX` en tête de chaque ligne
- **Client** (`/confirmation`) : badge `#XXXXXX` affiché dans le bandeau de statut (en préparation ou prête), coloré selon le statut (amber / green)
- **API** (`GET /api/commandes/suivi`) : expose `commandeId` (toString de `_id`) — donnée non personnelle, sûre à exposer publiquement

```typescript
function idCourt(id: string): string {
  return id.slice(-6).toUpperCase(); // ex: "A3F9C1"
}
```

---

## Design System — Composants UI partagés (Sprint 10.2)

### Composant `Button`

Tous les boutons de l'application utilisent le composant `components/ui/Button.tsx`.

**Variants disponibles :**

| Variant | Style | Usage |
|---------|-------|-------|
| `primary` | Bordure couleur principale + fond transparent + texte couleur | Action principale (CTA) |
| `danger` | Bordure rouge + fond rouge + texte blanc | Actions destructives (supprimer) |
| `ghost` | Bordure grise + texte gris | Actions secondaires, annulation |
| `outline` | Bordure noire + fond transparent + texte noir | Navigation, boutons neutres |

**Props :**
```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}
```

**Règles de contraste :** Le texte doit toujours être lisible sur le fond du bouton. Les couleurs de bordure/fond suivent la palette définie dans `SiteConfig.couleurBordureGauche` / `couleurBordureDroite` pour le variant `primary`.

> **Convention :** Aucun bouton ne doit utiliser des classes Tailwind en dur sans passer par ce composant. Les boutons existants doivent être migrés progressivement.

---

### Composant `BackLink`

Composant `components/ui/BackLink.tsx` — flèche `←` suivie d'un texte cliquable, utilisé pour la navigation retour entre pages.

**Props :**
```typescript
interface BackLinkProps {
  href: string;   // URL de destination
  label: string;  // Texte affiché ("Retour vers le menu", "Retour", etc.)
}
```

**Usage sur les pages :**
- `/profil` (haut gauche) : `<BackLink href="/" label="Retour vers le menu" />`
- `/panier` (haut gauche) : `<BackLink href="/" label="Retour vers le menu" />`
- Toute page où une navigation retour contextuelle est nécessaire

---

## Compte Client — Auth, Profil & Historique (Sprint 10–11)

### Politique de mot de passe (Zod)

```typescript
const PasswordSchema = z.string()
  .min(8, 'Minimum 8 caractères')
  .regex(/[A-Z]/, 'Au moins 1 majuscule')
  .regex(/[a-z]/, 'Au moins 1 minuscule')
  .regex(/[0-9]/, 'Au moins 1 chiffre')
  .regex(/[^A-Za-z0-9]/, 'Au moins 1 caractère spécial (!@#$%^&*)');
```

Validée côté **serveur** dans `POST /api/client/register` et côté **client** avec un indicateur de force visuel en temps réel.

---

### Auth étendue (NextAuth v4)

L'instance unique NextAuth (`lib/auth.ts`) est étendue avec deux providers supplémentaires :

| Provider | ID | Cas d'usage |
|----------|----|-------------|
| `Credentials` (admin, existant) | `admin-credentials` | Login admin via `ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH` env |
| `Credentials` (client, nouveau) | `client-credentials` | Login client email/mdp via collection `Client` MongoDB |
| `Google` (nouveau) | `google` | Login client OAuth Google |

**Rôles dans le JWT :**

```typescript
callbacks: {
  jwt({ token, user, account }) {
    if (user?.role) token.role = user.role;           // "admin" | "client"
    if (account?.provider === "google") token.role = "client";
    if (user?.id) token.sub = user.id;
    return token;
  },
  session({ session, token }) {
    session.user.role = token.role as string;
    session.user.id = token.sub as string;
    return session;
  }
}
```

**"Se souvenir de moi" — Consentement RGPD :**

- Checkbox non cochée par défaut avec notice : *"Vos informations resteront mémorisées 30 jours sur cet appareil."*
- Cochée → `maxAge: 2592000` (30 jours) via champ `rememberMe` passé dans les credentials et stocké dans le JWT
- Non cochée → `maxAge: 86400` (1 jour, session courte)
- Conforme RGPD Art. 7 : consentement explicite et granulaire

---

### Flux d'inscription (credentials)

```
[Page /auth/register] → POST /api/client/register
                           ↓ Zod : email + mdp fort + nom optionnel
                         Hash bcrypt (12 rounds) + insert Client (emailVerified: false)
                           ↓
                         Email vérification via Resend
                         (lien /auth/verify-email?token=xxx, valide 24h)
                           ↓
                         [Page "Vérifiez votre email"]
                           ↓
                         [Clic lien email] → POST /api/client/verify-email?token=xxx
                           ↓
                         emailVerified: true, token supprimé
                           ↓
                         Redirection → /auth/login (message de succès)
```

**Contrainte de sécurité :** La connexion via `client-credentials` retourne `null` si `emailVerified: false` avec un message explicite *"Veuillez vérifier votre email avant de vous connecter."*

---

### Flux de connexion (login page)

```
[Page /auth/login]
  ├── [Google OAuth]
  │     → NextAuth Google callback
  │     → Upsert Client (email unique, provider: "google", emailVerified: true)
  │     → session role=client
  │
  ├── [Email + Mot de passe]
  │     → client-credentials provider
  │     → vérifie emailVerified + bcrypt.compare
  │     → session role=client
  │
  └── [Continuer en tant qu'invité]
        → Redirection directe vers /
        → Pas de session (comportement actuel preservé)
```

**Google OAuth :** L'email Google est utilisé comme identifiant unique. Si un compte `credentials` existe déjà avec le même email, la connexion Google est bloquée avec un message explicite (*"Un compte existe déjà avec cet email."*). Pas de fusion automatique de comptes (sécurité).

---

### Flux de réinitialisation de mot de passe

```
[Page /auth/forgot-password] → POST /api/client/forgot-password
                                  ↓ (email si compte credentials existant)
                                Token crypto.randomBytes(32), expiry +1h
                                Stocké dans Client.passwordResetToken
                                Email via Resend (lien /auth/reset-password?token=xxx)
                                  ↓
                               [Page /auth/reset-password]
                                  ↓ POST /api/client/reset-password
                               Vérifie token + expiry
                               Nouveau hash bcrypt, token supprimé
                                  ↓
                               Redirection → /auth/login
```

> **Note sécurité :** `POST /api/client/forgot-password` retourne toujours `200` même si l'email n'existe pas (évite l'énumération de comptes).

---

### Page Profil (`/profil`)

Accessible via le bouton "Mon profil" positionné en haut à droite de la zone `<main>` du layout client (visible si `role === "client"`).

> **Sprint 15 (TICK-116) :** Le bouton "Mon profil" a été déplacé du `<header>` (`HeaderAuth.tsx`) vers la zone `<main>` du layout client (`app/(client)/layout.tsx`), positionné en `absolute top-4 right-4` avec `relative` sur le conteneur `<main>`.

**Contenu :**

| Section | Détail |
|---------|--------|
| Identité | Email affiché (non modifiable) + badge provider (Google / Email) |
| Nom affiché | Champ éditable, PATCH `/api/client/profil` · texte `text-gray-900` (WCAG AA) · bouton "Enregistrer" : `cursor-default` si non modifié (TICK-115) |
| Déconnexion | Bouton "Se déconnecter" → `signOut()` NextAuth |
| Mes commandes | Composant `HistoriqueCommandes` — commandes en cours + passées |
| Zone danger | Bouton "Supprimer mon compte" → bordure rouge + texte blanc, modale de confirmation + avertissement RGPD |

> **Sprint 10.2 :** La section "Mes données" (export RGPD Art. 20) est mise de côté — voir [Éléments mis de côté](#éléments-mis-de-côté--backlog-déféré). Le code correspondant (`GET /api/client/export`, bouton sur la page profil) a été retiré.

---

### Composant `HistoriqueCommandes`

Deux sections distinctes sur la page profil :

**1. Commandes en cours** (statut `en_attente_paiement` ou `payee`)
- Polling toutes les **10 secondes** (même logique que `/confirmation`)
- Badge coloré animé (amber = en préparation, green = prête)
- Numéro court `#XXXXXX`, produits, total, créneau

**2. Commandes passées** (statut `prete`)
- Ordre antéchronologique
- Numéro court, date, produits, total
- Bouton **"Commander à nouveau"** sur chaque ligne (voir ci-dessous)

```
GET /api/client/commandes
  → Retourne { enCours: Commande[], passees: Commande[] }
  → Filtrées par clientId de la session
  → Champs exposés : sans PII tierces (uniquement les données du client connecté)
```

### Re-commande rapide

Bouton "Commander à nouveau" affiché sur chaque commande passée dans `HistoriqueCommandes`.

**Comportement :**
1. Récupérer les `produitId` + `options` de la commande historique
2. Vérifier quels produits sont encore `actif: true` via `GET /api/produits`
3. Construire un panier filtré avec les produits disponibles uniquement
4. Écrire le résultat dans `localStorage` (clé `panier`, même format que le panier existant)
5. Rediriger vers `/panier`

**Règles UX :**
- Si tous les produits sont encore disponibles → panier pré-rempli, redirection immédiate
- Si certains produits ont été désactivés → toast d'avertissement *"X produit(s) ne sont plus disponibles et ont été retirés."* puis redirection
- Si aucun produit n'est disponible → message *"Aucun produit de cette commande n'est disponible."* sans redirection

> **Note technique :** La vérification d'activité est faite côté client (appel `GET /api/produits` public) — aucune nouvelle route serveur nécessaire. La logique réside entièrement dans le composant `HistoriqueCommandes`.

> **Sprint 15 (TICK-114) :** Correctif appliqué sur le fetch `GET /api/produits` dans `HistoriqueCommandes` — le bug provenait d'une comparaison `produitId` (ObjectId MongoDB sérialisé) vs string. Le bouton "Commander à nouveau" adopte un style discret (`variant="ghost"` ou `variant="outline"`, `text-sm`) pour ne pas dominer visuellement la carte de commande.

---

### Export de données (RGPD Art. 20 — Droit à la portabilité)

`GET /api/client/export` :

```
1. Vérifier session client (getServerSession)
2. Récupérer le document Client (sans passwordHash ni tokens)
3. Récupérer toutes les Commande où clientId === client._id
4. Construire le payload JSON structuré
5. Retourner en Content-Disposition: attachment; filename="mes-donnees-3g.json"
```

**Structure du fichier exporté :**
```json
{
  "exportDate": "2026-03-24T12:00:00.000Z",
  "compte": {
    "email": "...",
    "nom": "...",
    "provider": "credentials",
    "createdAt": "..."
  },
  "commandes": [
    {
      "id": "...",
      "date": "...",
      "statut": "...",
      "produits": [...],
      "total": 1250,
      "retrait": { "type": "creneau", "creneau": "12h30" }
    }
  ]
}
```

- `passwordHash`, tokens de vérification/reset et `clientId` interne **ne sont jamais exposés**
- Route soumise au rate limiting : 3 req / 15 min / IP (évite l'exfiltration en masse)
- Logger `client_data_exported` via `lib/logger.ts`

---

### Suppression de compte (RGPD Art. 17)

`DELETE /api/client/account` :

```
1. Vérifier session client (getServerSession)
2. Trouver toutes les Commande où clientId === client._id
3. Anonymiser chaque commande :
   client.nom → "[Supprimé]", client.telephone → "[Supprimé]",
   client.email → "[Supprimé]", clientId → null
4. Supprimer le document Client (deleteOne)
5. Logger l'événement "compte_client_supprime" via lib/logger.ts
6. Retourner 200
```

Côté client : après succès → `signOut({ callbackUrl: "/" })`.

---

### Rate limiting étendu (TICK-078)

| Route | Limite | Raison |
|-------|--------|--------|
| `POST /api/client/register` | 5 req / 15 min / IP | Anti-spam création de comptes |
| `POST /api/client/forgot-password` | 3 req / 15 min / IP | Anti-énumération + spam email |
| `POST /api/auth/callback/credentials` (existant) | 10 req / 15 min / IP | Anti-brute force admin |

Même mécanique Upstash + fallback in-memory que TICK-052/TICK-063.

---

### RGPD — Points spécifiques au compte client

| Point | Implémentation |
|-------|---------------|
| Finalité | Commandes et historique uniquement — base légale : contrat (Art. 6(1)(b)) |
| Données collectées | Email, nom optionnel, historique commandes. Aucune donnée marketing. |
| Durée de conservation | Durée de vie du compte. Suppression immédiate à la demande. |
| Droit à l'effacement | `DELETE /api/client/account` : compte supprimé + commandes anonymisées |
| Droit d'accès | `GET /api/client/commandes` expose les commandes du client |
| Droit à la portabilité | ⏸ Mis de côté (Sprint 10.2) — voir section "Éléments mis de côté". Route `GET /api/client/export` non exposée pour l'instant. |
| Google OAuth | Données reçues : email + nom Google. Informé sur la page login. |
| "Se souvenir de moi" | Consentement explicite, durée affichée (30 j), session courte sinon (1 j) |
| Nouveau sous-traitant | Google LLC — ajouter dans `/mentions-legales` section sous-traitants |
| Vérification email | Empêche l'usurpation d'adresse email tierce |

---

---

## Éléments mis de côté — Backlog déféré

Cette section recense les fonctionnalités intentionnellement exclues du scope actuel. Elles ont été spécifiées et partiellement architecturées mais leur implémentation est reportée à une version future.

> **Convention :** Ces éléments ne doivent pas être implémentés dans les sprints en cours. Tout ticket les concernant doit référencer cette section.

---

### Anonymisation manuelle des commandes (RGPD Art. 17 — Admin)

**Mis de côté lors de :** Sprint 14 (2026-03-26) — TICK-107
**Pourquoi :** Risque de manipulation accidentelle trop élevé sans UX de confirmation robuste ni gestion fine des permissions. La valeur métier immédiate est faible — l'anonymisation automatique (suppression compte) et la purge TTL couvrent les obligations légales.
**À reprendre quand :** Besoin métier confirmé (ex. demande client explicite ou obligation légale ponctuelle) avec UX de confirmation repensée (double validation, log d'audit).

**Périmètre mis de côté :**
- Bouton "Anonymiser" dans `components/admin/CommandeRow.tsx` (retiré de l'UI)
- Modale de confirmation associée

**Ce qui reste actif :**
- Route `DELETE /api/commandes/[id]` — conservée dans le code, non exposée dans l'UI admin
- Anonymisation automatique via `DELETE /api/client/account` (suppression compte client)
- Champ `purgeAt` sur `Commande` (index TTL MongoDB — purge automatique à 12 mois, TICK-060)

---

### Export de données personnelles (RGPD Art. 20 — Droit à la portabilité)

**Mis de côté lors de :** Sprint 10.2 (2026-03-24)
**Pourquoi :** Priorité produit revue — la valeur utilisateur de l'export JSON est faible à ce stade. La conformité RGPD Art. 20 peut être satisfaite ultérieurement.
**À reprendre quand :** Volume d'utilisateurs actifs significatif ou demande explicite utilisateur.

**Périmètre mis de côté :**
- `GET /api/client/export` — route API d'export (non implémentée)
- Bouton "Télécharger mes données" sur la page `/profil` (retiré du code)
- Rate limiting spécifique à cet endpoint (3 req/15min)

**Ce qui reste actif (droit d'accès, Art. 15) :**
- `GET /api/client/commandes` — le client peut voir ses commandes depuis le profil
- Suppression de compte `DELETE /api/client/account` — toujours disponible (RGPD Art. 17)

---

*Document généré le 2026-03-17 — Version 1.4 (Images + Cache RGPD + Stratégie de tests ajoutés le 2026-03-18) — Version 1.5 (Fallback upload local + stack réelle ajoutés le 2026-03-19) — Version 1.6 (Numéro de commande client ajouté le 2026-03-19) — Version 1.7 (Conventions de mock étendues + data-testid hero ajoutés le 2026-03-19) — Version 1.8 (Sprint 8 Sécurité & RGPD ajouté le 2026-03-20 : validation prix serveur, headers HTTP, rate limiting, magic bytes upload, middleware étendu, mock guard, CNIL, rétention RGPD, sous-traitants, logs structurés) — Version 1.9 (Sprint 9 Correctifs post-audit ajoutés le 2026-03-20 : index TTL MongoDB purgeAt, CSP sans unsafe-eval en prod, middleware /api/commandes/:id + IP non-spoofable, rate limiting fail-safe, Zod validation metadata webhook, logger mock-checkout) — Version 1.10 (Conventions de mock complétées le 2026-03-20 : file-type ESM mocké, vi.hoisted() pour factories dépendant de variables externes, connectDB + Produit mockés dans checkout) — Version 2.0 (Sprint 10–11 Compte Client ajouté le 2026-03-24 : modèle Client, auth étendue NextAuth Google + credentials client, inscription + vérification email, reset mdp, page profil, historique commandes, suppression compte RGPD, rate limiting étendu) — Version 2.1 (Re-commande rapide + Export RGPD Art. 20 ajoutés le 2026-03-24) — Version 2.2 (Sprint 10.2 ajouté le 2026-03-24 : écran choix invité/connexion, design system Button/BackLink, nom client obligatoire, historique commandes avancé, fix confirmation post-paiement, navigation retour, Mes données mis de côté) — Version 2.3 (Sprint 14 ajouté le 2026-03-26 : anonymisation manuelle commandes mise de côté, 7 correctifs UX & Auth admin + client) — Version 2.4 (Sprint 15 ajouté le 2026-03-26 : fix re-commande rapide + bouton discret TICK-114, contraste input + curseur profil TICK-115, bouton "Mon profil" déplacé header→main TICK-116) — Version 2.5 (Sprint 18 TICK-140–141 ajoutés le 2026-04-06 : export RGPD multi-tenant nomRestaurant, checklist onboarding complète, .env.local.example Sprint 18, seed-restaurant documenté)*

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
│   │   ├── commande/page.tsx      # Formulaire commande (nom, tel, créneau)
│   │   ├── confirmation/page.tsx  # Page post-paiement
│   │   └── layout.tsx
│   ├── (admin)/
│   │   ├── login/page.tsx
│   │   ├── commandes/page.tsx     # Liste commandes + statuts
│   │   ├── menu/page.tsx          # Gestion produits
│   │   ├── personnalisation/page.tsx  # Bannière, nom, couleurs bordures
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
│       └── webhooks/
│           └── stripe/route.ts    # Validation paiement Stripe
├── components/
│   ├── client/
│   │   ├── MenuCard.tsx
│   │   ├── Panier.tsx
│   │   └── FormulaireCommande.tsx
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
│   └── blob.ts                    # Helper Vercel Blob (upload)
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

### Produit

```typescript
{
  _id: ObjectId,
  nom: string,           // "Burger Classic"
  description: string,
  categorie: string,     // "Burgers", "Boissons", etc.
  prix: number,          // en centimes (ex: 850 = 8,50€)
  options: [             // suppléments
    { nom: string, prix: number }
  ],
  imageUrl?: string,     // URL Vercel Blob (optionnel)
  actif: boolean,
  createdAt: Date
}
```

### SiteConfig

```typescript
{
  _id: ObjectId,
  nomRestaurant: string,         // "Le Bistrot du Coin"
  banniereUrl?: string,          // URL image (HTTPS ou chemin /public)
  couleurBordureGauche: string,  // hex ex: "#E63946"
  couleurBordureDroite: string,  // hex ex: "#457B9D"
  updatedAt: Date
}
```

> Document **singleton** : un seul enregistrement en base, mis à jour par `upsert`.

---

### Commande

```typescript
{
  _id: ObjectId,
  stripeSessionId: string,     // pour webhook
  statut: "en_attente_paiement" | "payee" | "prete",
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
      prix: number,
      quantite: number,
      options: [{ nom: string, prix: number }]
    }
  ],
  commentaire?: string,
  total: number,               // en centimes
  createdAt: Date
}
```

---

## Flux principal (côté client)

```
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

---

## API Routes

| Méthode | Route                        | Rôle                                 | Auth   |
|---------|------------------------------|--------------------------------------|--------|
| GET     | /api/produits                | Liste produits actifs                | Public |
| POST    | /api/produits                | Créer produit                        | Admin  |
| PUT     | /api/produits/[id]           | Modifier produit                     | Admin  |
| PATCH   | /api/produits/[id]           | Activer/désactiver                   | Admin  |
| DELETE  | /api/produits/[id]           | Supprimer produit                    | Admin  |
| GET     | /api/commandes               | Liste commandes (admin)              | Admin  |
| POST    | /api/checkout                | Crée session Stripe + commande draft | Public |
| POST    | /api/webhooks/stripe         | Confirme paiement, envoie email      | Stripe |
| PATCH   | /api/commandes/[id]/statut   | Marquer comme "prête"                | Admin  |
| GET     | /api/site-config             | Lire la config vitrine               | Public |
| PUT     | /api/site-config             | Mettre à jour la config vitrine      | Admin  |
| POST    | /api/upload                  | Upload image (Vercel Blob ou local)  | Admin  |

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
- Middleware Next.js protège toutes les routes `/admin/*` et `/api/commandes/*`

```
Variables d'env :
ADMIN_EMAIL
ADMIN_PASSWORD_HASH   # bcrypt hash
NEXTAUTH_SECRET
```

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

- Polling auto toutes les **10 secondes** sur `/api/commandes`
- Implémenté avec `setInterval` + `useEffect` dans le composant admin
- Ou via `router.refresh()` de Next.js App Router

---

## Sécurité & RGPD (minimum viable)

| Point                 | Implémentation                                           |
|-----------------------|----------------------------------------------------------|
| HTTPS                 | Vercel (automatique, certificat Let's Encrypt)           |
| Données bancaires     | Jamais stockées (tout via Stripe)                        |
| Données personnelles  | nom, téléphone, email — suppression manuelle si besoin   |
| Webhook Stripe        | Vérification signature `stripe.webhooks.constructEvent`  |
| Routes admin          | Middleware NextAuth, JWT                                 |
| Variables sensibles   | `.env.local` jamais committé (`.gitignore`)              |
| Mentions légales      | Page statique `/mentions-legales`                        |
| Bandeau cookies       | Simple (pas de tracking tiers, juste session auth)       |

---

## Variables d'environnement

```env
# MongoDB
MONGODB_URI=mongodb+srv://...

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# NextAuth
NEXTAUTH_URL=https://monsite.vercel.app
NEXTAUTH_SECRET=...
ADMIN_EMAIL=admin@restaurant.fr
ADMIN_PASSWORD_HASH=$2b$10$...

# Email (Resend)
RESEND_API_KEY=re_...
EMAIL_FROM=commandes@restaurant.fr

# Vercel Blob (images)
# Optionnel en développement : si absent, les uploads sont sauvegardés dans public/uploads/
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
```

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
    "@ducanh2912/next-pwa": "^10.2.9"
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

> **Tests (Sprint 7) :** Vitest, Testing Library, MSW, mongodb-memory-server seront ajoutés en devDependencies lors du Sprint 7.

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
- **`localStorage`** : réinitialisé via `localStorage.clear()` dans `afterEach`.
- **Timers** : `vi.useFakeTimers()` pour tester le polling (`setInterval`) sans attente réelle.

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

*Document généré le 2026-03-17 — Version 1.4 (Images + Cache RGPD + Stratégie de tests ajoutés le 2026-03-18) — Version 1.5 (Fallback upload local + stack réelle ajoutés le 2026-03-19) — Version 1.6 (Numéro de commande client ajouté le 2026-03-19)*

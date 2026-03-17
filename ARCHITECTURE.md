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
│       └── webhooks/
│           └── stripe/route.ts    # Validation paiement Stripe
├── components/
│   ├── client/
│   │   ├── MenuCard.tsx
│   │   ├── Panier.tsx
│   │   └── FormulaireCommande.tsx
│   └── admin/
│       ├── CommandeRow.tsx
│       └── ProduitForm.tsx
├── lib/
│   ├── mongodb.ts                 # Connexion Mongoose (singleton)
│   ├── stripe.ts                  # Client Stripe
│   ├── email.ts                   # Envoi email confirmation
│   └── auth.ts                    # Config NextAuth
├── models/
│   ├── Produit.ts
│   └── Commande.ts
├── public/
│   ├── manifest.json              # PWA manifest
│   └── icons/
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
  actif: boolean,
  createdAt: Date
}
```

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
| **Total**           |            | ~8 pages, ~10 API  |

---

## Dépendances principales

```json
{
  "dependencies": {
    "next": "^14",
    "react": "^18",
    "mongoose": "^8",
    "stripe": "^14",
    "next-auth": "^4",
    "bcryptjs": "^2",
    "resend": "^3",
    "next-pwa": "^5",
    "tailwindcss": "^3",
    "zod": "^3"
  }
}
```

---

*Document généré le 2026-03-17 — Version MVP*

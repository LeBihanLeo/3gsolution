# 3G Solution — Plateforme de commande en ligne

Application Next.js de commande en ligne pour restauration rapide.
Stack : Next.js · MongoDB Atlas · Stripe · NextAuth.js · Tailwind CSS

---

## Installation

```bash
npm install
cp .env.local.example .env.local
# Remplir .env.local avec vos valeurs
npm run dev
```

---

## Variables d'environnement

Copiez `.env.local.example` en `.env.local` et renseignez :

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | URI de connexion MongoDB Atlas |
| `STRIPE_SECRET_KEY` | Clé secrète Stripe |
| `STRIPE_WEBHOOK_SECRET` | Secret webhook Stripe |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Clé publique Stripe |
| `NEXTAUTH_URL` | URL de l'app (http://localhost:3000 en dev) |
| `NEXTAUTH_SECRET` | Secret JWT NextAuth (chaîne aléatoire) |
| `ADMIN_EMAIL` | Email du compte admin |
| `ADMIN_PASSWORD_HASH` | Hash bcrypt du mot de passe admin |
| `RESEND_API_KEY` | Clé API Resend pour les emails |
| `EMAIL_FROM` | Adresse expéditeur des emails |

### Générer le hash du mot de passe admin

```bash
npx ts-node scripts/generate-hash.ts <votre_mot_de_passe>
```

Copiez le hash dans `.env.local` → `ADMIN_PASSWORD_HASH`.

---

## Structure du projet

```
app/
├── (client)/          # Zone client (menu, panier, commande)
├── (admin)/           # Zone admin (login, commandes, menu)
│   └── login/         # Page de connexion admin
└── api/
    ├── auth/          # NextAuth handler
    ├── produits/      # CRUD produits
    ├── commandes/     # Lecture + statut commandes
    ├── checkout/      # Session Stripe (Sprint 3)
    └── webhooks/      # Webhook Stripe (Sprint 3)
components/
├── client/            # Composants zone client
└── admin/             # Composants zone admin
lib/
├── mongodb.ts         # Connexion Mongoose singleton
├── auth.ts            # Config NextAuth
├── stripe.ts          # Client Stripe (Sprint 3)
└── email.ts           # Envoi email (Sprint 3)
models/
├── Produit.ts         # Modèle Mongoose produit
└── Commande.ts        # Modèle Mongoose commande
middleware.ts          # Protection routes admin
```

---

## Développement

```bash
npm run dev     # Serveur de développement
npm run build   # Build production
npm run lint    # Linting ESLint
```

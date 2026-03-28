# Backlog de développement — Plateforme de commande en ligne
> Généré le 2026-03-17 · Basé sur ARCHITECTURE.md · Sizing en jours/dev
> Mis à jour le 2026-03-26 · Sprint 15 ajouté

---

## Récapitulatif

| Sprint | Épic | Tickets | Charge totale |
|--------|------|---------|---------------|
| 1 | Setup, Modèles, Auth | TICK-001 → 008 | 5,5 j |
| 2 | API, Frontend Client | TICK-009 → 016 | 6,0 j |
| 3 | Paiement, Admin, Email, PWA, Déploiement | TICK-017 → 027 | 6,5 j |
| 4 | Créneaux 15 min & Suivi commande client | TICK-028 → 030 | 3,0 j |
| 5 | Personnalisation de la vitrine | TICK-031 → 033 | 2,0 j |
| 6 | Images produits, Upload bannière, Cache RGPD | TICK-034 → 040 | 5,5 j | ✅ Implémenté |
| 7 | Tests unitaires & intégration | TICK-041 → 049 | 7,0 j |
| 8 | Sécurité & RGPD (audit) | TICK-050 → 059 | 6,5 j | ✅ Implémenté |
| 9 | Sécurité & RGPD — corrections post-audit | TICK-060 → 064 | 2,5 j |
| 10 | Compte Client — Auth, Inscription & Profil | TICK-065 → 074 | 8,0 j | ✅ Implémenté |
| 10.2 | Corrections UX & Design System Sprint 10 | TICK-075 → 077 (avancés), TICK-082 → 089 | 6,0 j | ✅ Implémenté |
| 11 | Compte Client — Finalisation & RGPD Export | TICK-078 → 081 | 2,5 j | ✅ Implémenté |
| 11.5 | Correctifs UX profil & contraste boutons | TICK-090 → 093 | 0,5 j | ✅ Implémenté |
| 12 | Corrections UX Client — Historique, Stepper, Suivi | TICK-094 → 099 | 3,75 j |
| 13 | Dashboard Admin & Gestion Avancée | TICK-100 → 106 | 5,25 j | ✅ Implémenté |
| 14 | Correctifs UX & Auth — Admin + Client | TICK-107 → 113 | 2,25 j |
| 15 | Correctifs UX Client — Re-commande, Profil, Navigation | TICK-114 → 116 | 1,0 j |
| 16 | Refactoring Admin, Palette Couleur & Correctifs | TICK-117 → 125 | 7,0 j |
| **Total** | | **125 tickets** | **~83,75 j** |

> **Convention sizing :** 1 jour = 1 développeur full-stack junior/intermédiaire.
> Réduire de ~30 % pour un dev senior ayant déjà travaillé sur Next.js + Stripe.

---

## Légende priorités

| Label | Signification |
|-------|---------------|
| 🔴 Bloquant | Requis avant tout autre ticket |
| 🟠 Haute | Livrable Sprint courant |
| 🟡 Moyenne | Peut glisser d'un sprint |
| 🟢 Basse | Nice-to-have MVP |

---

## Sprint 1 — Fondations (5,5 j)

### TICK-001 — Initialisation du projet Next.js 14
**Épic :** Setup & Infrastructure
**Priorité :** 🔴 Bloquant
**Sizing :** 0,5 j
**Dépendances :** aucune

**Description :**
Bootstrapper le projet avec `create-next-app`, configurer Tailwind CSS, la structure de dossiers définie dans l'architecture, et committer le squelette vide.

**Critères d'acceptance :**
- [ ] `npx create-next-app` avec TypeScript + App Router
- [ ] Tailwind CSS installé et fonctionnel (`tailwind.config.ts`)
- [ ] Structure `app/(client)/`, `app/(admin)/`, `app/api/`, `components/`, `lib/`, `models/` créée
- [ ] `.env.local.example` avec toutes les variables documentées
- [ ] `.gitignore` inclut `.env.local`
- [ ] `npm run dev` démarre sans erreur

---

### TICK-002 — Configuration MongoDB Atlas + Mongoose
**Épic :** Setup & Infrastructure
**Priorité :** 🔴 Bloquant
**Sizing :** 0,5 j
**Dépendances :** TICK-001

**Description :**
Créer le cluster MongoDB Atlas (free tier), configurer la connexion via singleton Mongoose dans `lib/mongodb.ts`.

**Critères d'acceptance :**
- [ ] Cluster Atlas créé, IP whitelist configurée (0.0.0.0/0 pour dev)
- [ ] `lib/mongodb.ts` implémente le pattern singleton (évite les connexions multiples en hot-reload Next.js)
- [ ] `MONGODB_URI` chargé depuis `.env.local`
- [ ] Test de connexion réussi (log console au démarrage)

---

### TICK-003 — Modèle Mongoose : Produit
**Épic :** Modèles de données
**Priorité :** 🔴 Bloquant
**Sizing :** 0,5 j
**Dépendances :** TICK-002

**Description :**
Implémenter `models/Produit.ts` avec le schéma défini en architecture, types TypeScript inclus.

**Critères d'acceptance :**
- [ ] Champs : `nom`, `description`, `categorie`, `prix` (centimes), `options[]`, `actif`, `createdAt`
- [ ] Interface TypeScript `IProduit` exportée
- [ ] Validation Mongoose sur les champs obligatoires
- [ ] `prix` en centimes (number, min: 0)
- [ ] Export du modèle avec guard `mongoose.models.Produit || mongoose.model(...)`

---

### TICK-004 — Modèle Mongoose : Commande
**Épic :** Modèles de données
**Priorité :** 🔴 Bloquant
**Sizing :** 0,5 j
**Dépendances :** TICK-002

**Description :**
Implémenter `models/Commande.ts` avec le schéma complet, snapshot produits inclus.

**Critères d'acceptance :**
- [ ] Champs : `stripeSessionId`, `statut` (enum), `client{}`, `retrait{}`, `produits[]`, `commentaire`, `total`, `createdAt`
- [ ] Enum statut : `"en_attente_paiement" | "payee" | "prete"`
- [ ] Interface TypeScript `ICommande` exportée
- [ ] Index unique sur `stripeSessionId` (idempotence webhook)
- [ ] Snapshot produit (`nom`, `prix`, `quantite`, `options`) dans le sous-document

---

### TICK-005 — Authentification Admin (NextAuth.js)
**Épic :** Auth Admin
**Priorité :** 🔴 Bloquant
**Sizing :** 1 j
**Dépendances :** TICK-001

**Description :**
Configurer NextAuth.js avec provider `Credentials`, JWT stateless, et middleware de protection des routes admin.

**Critères d'acceptance :**
- [ ] `lib/auth.ts` : config NextAuth avec provider Credentials
- [ ] Vérification mot de passe via `bcryptjs.compare()` contre `ADMIN_PASSWORD_HASH`
- [ ] Session JWT (pas de base de données sessions)
- [ ] `middleware.ts` à la racine protège `/admin/*` et `/api/commandes/*` (redirect `/admin/login` si non authentifié)
- [ ] Variables d'env : `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `NEXTAUTH_SECRET`
- [ ] Script utilitaire pour générer le hash bcrypt documenté dans README

---

### TICK-006 — Page Login Admin
**Épic :** Auth Admin
**Priorité :** 🟠 Haute
**Sizing :** 0,5 j
**Dépendances :** TICK-005

**Description :**
Créer `app/(admin)/login/page.tsx` avec formulaire email/mot de passe.

**Critères d'acceptance :**
- [ ] Formulaire email + password avec validation client
- [ ] Appel `signIn("credentials", ...)` de NextAuth
- [ ] Affichage message d'erreur en cas d'échec
- [ ] Redirection vers `/admin/commandes` après succès
- [ ] Layout admin sans nav (pas de guard sur cette page)

---

### TICK-007 — API : CRUD Produits (admin)
**Épic :** API Routes
**Priorité :** 🟠 Haute
**Sizing :** 1 j
**Dépendances :** TICK-003, TICK-005

**Description :**
Implémenter les 4 routes API de gestion des produits, toutes protégées admin.

**Routes à créer :**

| Méthode | Route | Action |
|---------|-------|--------|
| GET | `/api/produits` | Liste produits actifs (public) |
| POST | `/api/produits` | Créer produit (admin) |
| PUT | `/api/produits/[id]` | Modifier produit complet (admin) |
| PATCH | `/api/produits/[id]` | Toggle `actif` (admin) |
| DELETE | `/api/produits/[id]` | Supprimer produit (admin) |

**Critères d'acceptance :**
- [ ] GET public : retourne uniquement `{ actif: true }`, trié par catégorie
- [ ] POST/PUT/DELETE/PATCH : vérification session NextAuth (`getServerSession`)
- [ ] Validation des données entrantes avec Zod
- [ ] Réponses JSON cohérentes (`{ data }` ou `{ error }`)
- [ ] Gestion erreur 404 si produit introuvable

---

### TICK-008 — API : Gestion statut commandes (admin)
**Épic :** API Routes
**Priorité :** 🟠 Haute
**Sizing :** 0,5 j
**Dépendances :** TICK-004, TICK-005

**Description :**
Implémenter les routes de lecture et mise à jour de statut des commandes.

**Routes à créer :**

| Méthode | Route | Action |
|---------|-------|--------|
| GET | `/api/commandes` | Liste toutes les commandes (admin) |
| PATCH | `/api/commandes/[id]/statut` | Passer à `"prete"` (admin) |

**Critères d'acceptance :**
- [ ] GET : liste triée par `createdAt` DESC, toutes les commandes (pas de filtre statut)
- [ ] PATCH : validation que le nouveau statut est `"prete"` uniquement
- [ ] Protection middleware NextAuth sur les deux routes
- [ ] Réponse 200 avec la commande mise à jour

---

## Sprint 2 — Frontend Client (6,0 j)

### TICK-009 — Layout & navigation client
**Épic :** Frontend Client
**Priorité :** 🟠 Haute
**Sizing :** 0,5 j
**Dépendances :** TICK-001

**Description :**
Créer `app/(client)/layout.tsx` avec la structure de base : header (nom du restaurant, logo), footer minimal, et le provider panier (Context API ou Zustand).

**Critères d'acceptance :**
- [ ] Layout client responsive (mobile-first)
- [ ] Header avec nom/logo restaurant
- [ ] Context ou store panier initialisé et disponible dans toute la zone client
- [ ] Aucune fuite de données entre zone client et admin

---

### TICK-010 — Page Menu principal (liste produits)
**Épic :** Frontend Client
**Priorité :** 🟠 Haute
**Sizing :** 1,5 j
**Dépendances :** TICK-007, TICK-009

**Description :**
Implémenter `app/(client)/page.tsx` avec affichage des produits groupés par catégorie et le composant `MenuCard`.

**Critères d'acceptance :**
- [ ] Fetch `GET /api/produits` au chargement (SSR ou CSR)
- [ ] Composant `MenuCard` : nom, description, prix formaté (€), bouton "Ajouter"
- [ ] Groupement visuel par catégorie (section par catégorie)
- [ ] Gestion état vide (aucun produit disponible)
- [ ] Gestion état chargement (skeleton ou spinner)
- [ ] Bouton "Voir le panier" visible si panier non vide (badge quantité)
- [ ] Support des options produit (modal ou inline)

---

### TICK-011 — Composant Panier (localStorage)
**Épic :** Frontend Client
**Priorité :** 🟠 Haute
**Sizing :** 1 j
**Dépendances :** TICK-009

**Description :**
Implémenter `app/(client)/panier/page.tsx` et le composant `Panier.tsx` avec persistance localStorage.

**Critères d'acceptance :**
- [ ] Ajout/suppression produits, modification quantités
- [ ] Persistance en `localStorage` (survit au rechargement)
- [ ] Calcul du total (centimes → euros, formaté)
- [ ] Affichage récapitulatif des options sélectionnées
- [ ] Bouton "Commander" désactivé si panier vide
- [ ] Bouton "Vider le panier"
- [ ] Redirection vers `/commande` au clic "Commander"

---

### TICK-012 — Formulaire de commande
**Épic :** Frontend Client
**Priorité :** 🟠 Haute
**Sizing :** 1 j
**Dépendances :** TICK-011

**Description :**
Implémenter `app/(client)/commande/page.tsx` avec le formulaire client et le composant `FormulaireCommande.tsx`.

**Critères d'acceptance :**
- [ ] Champs : nom (requis), téléphone (requis), email (optionnel), type retrait, créneau horaire
- [ ] Validation côté client avec Zod (format téléphone FR, email valide si fourni)
- [ ] Champ créneau conditionnel (visible uniquement si "retrait programmé" sélectionné)
- [ ] Champ commentaire libre (optionnel)
- [ ] Résumé de la commande visible sur la page
- [ ] Au submit : POST `/api/checkout` puis redirection vers URL Stripe
- [ ] Gestion d'erreur si le checkout échoue

---

### TICK-013 — Page Confirmation post-paiement
**Épic :** Frontend Client
**Priorité :** 🟡 Moyenne
**Sizing :** 0,5 j
**Dépendances :** TICK-012

**Description :**
Implémenter `app/(client)/confirmation/page.tsx` affichant le récapitulatif après retour Stripe.

**Critères d'acceptance :**
- [ ] Lecture du `session_id` en query param
- [ ] Affichage : numéro de commande, récapitulatif produits, créneau de retrait
- [ ] Message de confirmation clair ("Votre commande est confirmée")
- [ ] Vider le panier localStorage après confirmation
- [ ] Gestion du cas où `session_id` est absent ou invalide (page d'erreur)
- [ ] Bouton "Retour au menu"

---

### TICK-014 — Layout & nav Admin
**Épic :** Espace Admin
**Priorité :** 🟠 Haute
**Sizing :** 0,5 j
**Dépendances :** TICK-005

**Description :**
Créer `app/(admin)/layout.tsx` avec guard d'authentification, navigation entre les sections admin, et bouton déconnexion.

**Critères d'acceptance :**
- [ ] Vérification session au niveau layout (redirect login si non authentifié)
- [ ] Navigation : "Commandes" / "Menu"
- [ ] Bouton "Se déconnecter" (`signOut`)
- [ ] Layout adapté desktop (les admins utilisent probablement un PC)

---

### TICK-015 — Page Admin : Gestion des commandes
**Épic :** Espace Admin
**Priorité :** 🟠 Haute
**Sizing :** 1 j
**Dépendances :** TICK-008, TICK-014

**Description :**
Implémenter `app/(admin)/commandes/page.tsx` avec le composant `CommandeRow.tsx` et le polling automatique.

**Critères d'acceptance :**
- [ ] Liste de commandes triées par date DESC
- [ ] `CommandeRow` affiche : ID court, nom client, téléphone, total €, créneau, statut, heure
- [ ] Filtre ou distinction visuelle par statut (`payée` / `prête`)
- [ ] Bouton "Marquer comme prête" sur les commandes `payée` → PATCH `/api/commandes/[id]/statut`
- [ ] Polling automatique toutes les **10 secondes** (`setInterval` + `useEffect`)
- [ ] Indicateur visuel "Mise à jour automatique" (dernière sync)
- [ ] Pas de rechargement complet de page lors du polling

---

## Sprint 3 — Paiement, Admin Menu, Email, PWA, Déploiement (6,5 j)

### TICK-016 — Page Admin : Gestion du menu
**Épic :** Espace Admin
**Priorité :** 🟡 Moyenne
**Sizing :** 1 j
**Dépendances :** TICK-007, TICK-014

**Description :**
Implémenter `app/(admin)/menu/page.tsx` avec le formulaire `ProduitForm.tsx` pour le CRUD complet.

**Critères d'acceptance :**
- [ ] Liste des produits (tous statuts) avec badge actif/inactif
- [ ] `ProduitForm` : nom, description, catégorie (select ou input libre), prix (€), options dynamiques
- [ ] Ajout/suppression d'options (paires nom + prix)
- [ ] Toggle actif/inactif par produit (sans confirmation)
- [ ] Suppression avec confirmation (modale ou `confirm()`)
- [ ] Feedback visuel après chaque action (toast ou message inline)

---

### TICK-017 — Intégration Stripe Checkout
**Épic :** Paiement
**Priorité :** 🔴 Bloquant
**Sizing :** 1,5 j
**Dépendances :** TICK-004, TICK-012

**Description :**
Implémenter `lib/stripe.ts` et `app/api/checkout/route.ts` pour créer la session Stripe Checkout.

**Critères d'acceptance :**
- [ ] `lib/stripe.ts` : client Stripe initialisé avec `STRIPE_SECRET_KEY`
- [ ] POST `/api/checkout` :
  - Validation du body (produits, infos client) avec Zod
  - Création `Stripe.Checkout.Session` avec `line_items` (nom, prix unitaire, quantité)
  - `mode: "payment"`, `success_url`, `cancel_url` paramétrés
  - Stockage des métadonnées client dans `metadata` de la session
- [ ] Retour de `{ url }` au client → redirection JS
- [ ] Variables d'env : `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- [ ] Test en mode Stripe sandbox avec carte `4242 4242 4242 4242`

---

### TICK-018 — Webhook Stripe (création commande + email)
**Épic :** Paiement
**Priorité :** 🔴 Bloquant
**Sizing :** 1,5 j
**Dépendances :** TICK-004, TICK-017, TICK-022

**Description :**
Implémenter `app/api/webhooks/stripe/route.ts` — point central de vérité : confirme le paiement, crée la commande en base, envoie l'email.

**Critères d'acceptance :**
- [ ] Lecture du body **brut** (`request.text()`) pour la vérification signature
- [ ] Vérification signature : `stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)`
- [ ] Traitement uniquement de l'événement `checkout.session.completed`
- [ ] Idempotence : vérifier que `stripeSessionId` n'existe pas déjà en base (index unique)
- [ ] Création `Commande` en base avec statut `"payee"`, snapshot produits depuis les métadonnées
- [ ] Appel `lib/email.ts` si email client fourni
- [ ] Retour HTTP 200 rapide (Stripe considère timeout > 30s comme échec)
- [ ] Gestion d'erreur : log sans crash (Stripe retentera sinon)
- [ ] Test avec Stripe CLI : `stripe listen --forward-to localhost:3000/api/webhooks/stripe`

---

### TICK-019 — Service d'envoi d'email (Resend)
**Épic :** Email
**Priorité :** 🟡 Moyenne
**Sizing :** 0,5 j
**Dépendances :** TICK-001

**Description :**
Implémenter `lib/email.ts` avec le template HTML de confirmation de commande via Resend.

**Critères d'acceptance :**
- [ ] Fonction `sendConfirmationEmail(commande: ICommande): Promise<void>`
- [ ] Template HTML : récapitulatif produits, total €, créneau de retrait, numéro de commande
- [ ] Expéditeur configuré via `EMAIL_FROM`
- [ ] Gestion silencieuse des erreurs (l'email ne doit pas faire échouer le webhook)
- [ ] Variable d'env : `RESEND_API_KEY`

---

### TICK-020 — Configuration PWA
**Épic :** PWA
**Priorité :** 🟢 Basse
**Sizing :** 0,5 j
**Dépendances :** TICK-001

**Description :**
Configurer `next-pwa` pour rendre l'application installable sur mobile.

**Critères d'acceptance :**
- [ ] `next-pwa` installé et configuré dans `next.config.js`
- [ ] `public/manifest.json` : `name`, `short_name`, `icons` (192x192, 512x512), `display: "standalone"`, `background_color`, `theme_color`, `start_url: "/"`
- [ ] Icônes PNG aux deux résolutions dans `public/icons/`
- [ ] Service worker : cache statique uniquement (pas d'offline)
- [ ] PWA installable sur Android Chrome (test "Add to Home Screen")
- [ ] Désactivé en mode développement (`disable: process.env.NODE_ENV === "development"`)

---

### TICK-021 — Page Mentions légales + Bandeau cookies
**Épic :** Sécurité & RGPD
**Priorité :** 🟢 Basse
**Sizing :** 0,5 j
**Dépendances :** TICK-009

**Description :**
Créer la page statique `/mentions-legales` et le bandeau cookie minimal.

**Critères d'acceptance :**
- [ ] Page `/mentions-legales` : éditeur, hébergeur, données personnelles collectées, durée conservation, droits RGPD (contact)
- [ ] Bandeau cookie : affiché à la première visite, bouton "J'accepte" ou "Continuer"
- [ ] Le bandeau ne bloque pas la navigation (UX non-intrusive)
- [ ] Lien "Mentions légales" dans le footer client
- [ ] Pas de tracking tiers (Google Analytics, etc.) — bandeau simplifié suffisant

---

### TICK-022 — Déploiement Vercel + configuration production
**Épic :** Déploiement
**Priorité :** 🟠 Haute
**Sizing :** 0,5 j
**Dépendances :** tous les tickets TICK-001 à TICK-019

**Description :**
Déployer sur Vercel et configurer l'environnement de production.

**Critères d'acceptance :**
- [ ] Projet connecté à Vercel via GitHub
- [ ] Toutes les variables d'environnement configurées dans Vercel Dashboard
- [ ] Domaine personnalisé configuré (ou URL Vercel)
- [ ] `NEXTAUTH_URL` pointe vers l'URL de production
- [ ] Webhook Stripe endpoint mis à jour avec l'URL de production
- [ ] Whitelist IP MongoDB Atlas mise à jour (ou 0.0.0.0/0 si acceptable)
- [ ] Build de production réussi sans warnings critiques

---

### TICK-023 — Tests End-to-End du flux complet
**Épic :** QA
**Priorité :** 🟠 Haute
**Sizing :** 1 j
**Dépendances :** TICK-022

**Description :**
Recette complète du flux de commande en environnement de staging/production avec Stripe en mode test.

**Scénarios à tester :**

| # | Scénario | Résultat attendu |
|---|----------|-----------------|
| 1 | Navigation menu, ajout produit au panier | Panier mis à jour, badge visible |
| 2 | Ajout option supplémentaire | Option reflétée dans le panier |
| 3 | Panier persisté après rechargement | localStorage intact |
| 4 | Remplir formulaire commande valide | Redirection vers Stripe Checkout |
| 5 | Paiement Stripe avec carte test | Redirection vers `/confirmation` |
| 6 | Webhook reçu | Commande créée en base avec statut `payee` |
| 7 | Email de confirmation reçu | Email avec bon récapitulatif |
| 8 | Commande visible dans admin | Apparaît dans la liste sous 10s (polling) |
| 9 | Admin marque commande "prête" | Statut mis à jour en temps réel |
| 10 | Paiement annulé par client | Pas de commande créée en base |
| 11 | Login admin avec mauvais mot de passe | Erreur affichée, pas de session |
| 12 | Accès direct `/admin/commandes` sans auth | Redirection vers login |

---

## Sprint 4 — Créneaux 15 min & Suivi commande client (3,0 j)

### TICK-028 — Créneaux horaires de 15 minutes avec plage restaurant
**Épic :** Frontend Client
**Priorité :** 🟠 Haute
**Sizing :** 1,0 j
**Dépendances :** TICK-012

**Description :**
Remplacer le champ créneau libre par un sélecteur de créneaux de 15 minutes générés dynamiquement à partir des horaires d'ouverture du restaurant. Les créneaux sont affichés sous la forme `12:00 – 12:15`, `12:15 – 12:30`, etc. Les horaires sont configurables via des variables d'environnement.

**Périmètre technique :**
- Nouvelle utility `lib/creneaux.ts` : génère la liste des créneaux depuis `RESTAURANT_OUVERTURE` / `RESTAURANT_FERMETURE` (format `"HH:MM"`) et un pas configurable `RESTAURANT_PAS_MINUTES` (défaut `15`)
- Modification `models/Commande.ts` : `retrait.creneau` stocke le créneau complet au format `"HH:MM – HH:MM"`
- Modification `components/client/FormulaireCommande.tsx` : remplacer l'input texte par un `<select>` alimenté par `lib/creneaux.ts`
- Ajout variables d'env dans `.env.local.example`

**Critères d'acceptance :**
- [ ] `lib/creneaux.ts` exporte `genererCreneaux(ouverture: string, fermeture: string, pas: number): string[]`
- [ ] Exemple avec 12:00–14:00 / pas 15 min → 8 créneaux : `12:00 – 12:15` … `13:45 – 14:00`
- [ ] Le `<select>` est affiché uniquement si le type de retrait est `"creneau"` (comportement conditionnel inchangé)
- [ ] La valeur soumise au backend est `"12:00 – 12:15"` (chaîne complète)
- [ ] Validation Zod mise à jour : le champ `creneau` doit correspondre à un créneau valide de la liste générée
- [ ] Variables d'env : `RESTAURANT_OUVERTURE=12:00`, `RESTAURANT_FERMETURE=14:00`, `RESTAURANT_PAS_MINUTES=15`
- [ ] Affichage adapté mobile (le select est full-width)
- [ ] Test : modification des variables d'env → liste recalculée automatiquement au redémarrage

---

### TICK-029 — API publique de suivi de commande
**Épic :** Suivi commande
**Priorité :** 🟠 Haute
**Sizing :** 0,5 j
**Dépendances :** TICK-004, TICK-008

**Description :**
Créer un endpoint public `GET /api/commandes/suivi` permettant à un client de consulter le statut et les informations non-sensibles de sa commande à partir de son `stripeSessionId`. Cet endpoint ne renvoie **pas** les données personnelles complètes (téléphone masqué, pas d'email).

**Route à créer :**

| Méthode | Route | Action |
|---------|-------|--------|
| GET | `/api/commandes/suivi?session_id=xxx` | Statut commande (public, limité) |

**Critères d'acceptance :**
- [ ] Lookup Mongoose par `stripeSessionId` (index unique → requête O(1))
- [ ] Réponse en cas de succès (HTTP 200) :
  ```json
  {
    "statut": "payee" | "prete",
    "retrait": { "type": "immediat" | "creneau", "creneau": "12:00 – 12:15" },
    "produits": [{ "nom": "...", "quantite": 2 }],
    "total": 1700,
    "createdAt": "ISO8601"
  }
  ```
- [ ] Données exclues : `client.telephone`, `client.email`, `stripeSessionId`, `_id`
- [ ] `session_id` absent ou invalide → HTTP 400 / 404 avec `{ error: "..." }`
- [ ] Statut `"en_attente_paiement"` → HTTP 404 (commande non encore confirmée par webhook)
- [ ] Aucune auth requise (public)
- [ ] Rate limiting recommandé (documenté, non-bloquant pour le ticket)

---

### TICK-030 — Page de suivi commande client (polling temps réel)
**Épic :** Suivi commande
**Priorité :** 🟠 Haute
**Sizing :** 1,5 j
**Dépendances :** TICK-013, TICK-029

**Description :**
Refondre `app/(client)/confirmation/page.tsx` en page de suivi active : après le paiement, le client voit l'état de sa commande mis à jour automatiquement toutes les 15 secondes jusqu'à ce qu'elle passe à `"prete"`. Un indicateur visuel clair distingue les deux états (`payee` = en préparation, `prete` = prête à récupérer).

**Comportement attendu :**

```
[Étape 1] Commande reçue — paiement confirmé
  └── Indicateur animé "En cours de préparation..."
  └── Rappel du créneau choisi
  └── Résumé des produits commandés

[Étape 2] Commande prête (statut → "prete")
  └── Message mis en avant : "Votre commande est prête ! Venez la récupérer."
  └── Créneau affiché en gras
  └── Arrêt du polling
  └── Notification sonore légère (optionnel, si permissions navigateur)
```

**Critères d'acceptance :**
- [ ] Lecture du `session_id` depuis le query param (comportement identique à TICK-013)
- [ ] Appel initial `GET /api/commandes/suivi?session_id=xxx` au montage du composant
- [ ] Polling `GET /api/commandes/suivi` toutes les **15 secondes** via `setInterval` + `useEffect`
- [ ] Le polling s'arrête dès que `statut === "prete"` (pas de requêtes inutiles)
- [ ] Nettoyage du `setInterval` au démontage du composant (`clearInterval` dans le return du useEffect)
- [ ] État `payee` : bandeau orange/amber "En préparation" avec animation (pulse ou spinner)
- [ ] État `prete` : bandeau vert "Commande prête — venez la récupérer !" (icône check)
- [ ] Résumé non-interactif : liste produits (nom + quantité), total €, créneau de retrait
- [ ] Le panier localStorage est vidé à l'arrivée sur cette page (identique à TICK-013)
- [ ] Indicateur discret "Dernière mise à jour : il y a X s"
- [ ] Gestion `session_id` absent / commande introuvable → message d'erreur + lien retour menu
- [ ] Bouton "Retour au menu" visible en permanence
- [ ] Page responsive mobile (le client consulte depuis son téléphone)

---

## Sprint 5 — Personnalisation de la vitrine (2,0 j)

### TICK-031 — Modèle Mongoose : SiteConfig + API CRUD
**Épic :** Personnalisation
**Priorité :** 🟠 Haute
**Sizing :** 0,5 j
**Dépendances :** TICK-002, TICK-005

**Description :**
Créer le modèle `models/SiteConfig.ts` (document singleton) et les routes API permettant de lire la configuration publiquement et de la modifier depuis l'espace admin.

**Schéma :**
```typescript
{
  _id: ObjectId,
  nomRestaurant: string,       // "Le Bistrot du Coin"
  banniereUrl?: string,        // URL absolue ou chemin /public
  couleurBordureGauche: string, // ex: "#E63946"
  couleurBordureDroite: string, // ex: "#457B9D"
  updatedAt: Date
}
```

**Routes à créer :**

| Méthode | Route | Action |
|---------|-------|--------|
| GET | `/api/site-config` | Lire la config (public) |
| PUT | `/api/site-config` | Mettre à jour la config (admin) |

**Critères d'acceptance :**
- [ ] `models/SiteConfig.ts` : interface `ISiteConfig` exportée, validation Mongoose sur les champs obligatoires
- [ ] Document unique en base : utiliser `findOneAndUpdate` avec `upsert: true` (jamais plus d'un document)
- [ ] `couleurBordureGauche` et `couleurBordureDroite` validées comme chaînes hexadécimales (`/^#[0-9A-Fa-f]{6}$/`)
- [ ] GET public : retourne la config complète (sans `_id`, sans `__v`)
- [ ] PUT admin : protégé par `getServerSession`, validation Zod du body
- [ ] Valeurs par défaut sensées si aucune config en base (nom = `"Mon Restaurant"`, couleurs = `"#000000"`)
- [ ] Variable d'env **aucune** requise (données persistées en base)

---

### TICK-032 — Page Admin : Personnalisation de la vitrine
**Épic :** Personnalisation
**Priorité :** 🟠 Haute
**Sizing :** 1,0 j
**Dépendances :** TICK-031, TICK-014

**Description :**
Implémenter `app/(admin)/personnalisation/page.tsx` avec un formulaire permettant à l'admin de configurer le nom du restaurant, l'URL de la bannière et les couleurs des bordures. Un aperçu en temps réel est affiché sous le formulaire.

**Critères d'acceptance :**
- [ ] Chargement initial : GET `/api/site-config` pour pré-remplir les champs
- [ ] Champ **Nom du restaurant** : `<input type="text">` (requis, max 80 caractères)
- [ ] Champ **URL de la bannière** : `<input type="url">` (optionnel) — accepte une URL externe (HTTPS) ou un chemin relatif `/images/...`
- [ ] Champ **Couleur bordure gauche** : `<input type="color">` + `<input type="text">` synchronisés (valeur hex)
- [ ] Champ **Couleur bordure droite** : idem
- [ ] **Aperçu en temps réel** sous le formulaire :
  - Bande colorée gauche / droite aux couleurs choisies
  - Bannière visible si URL renseignée (`<img>` avec fallback gracieux si URL invalide)
  - Nom du restaurant affiché dans l'aperçu
- [ ] Bouton "Enregistrer" : PUT `/api/site-config` avec les valeurs du formulaire
- [ ] Validation Zod côté client (couleurs hexadécimales, URL valide ou vide)
- [ ] Feedback visuel après sauvegarde (toast "Modifications enregistrées" ou message inline)
- [ ] Lien "Personnalisation" ajouté dans la navigation du layout admin (`TICK-014`)

---

### TICK-033 — Application de la config dans le layout client
**Épic :** Personnalisation
**Priorité :** 🟠 Haute
**Sizing :** 0,5 j
**Dépendances :** TICK-031, TICK-009

**Description :**
Modifier `app/(client)/layout.tsx` pour charger la `SiteConfig` côté serveur (SSR) et l'appliquer visuellement : bordures colorées gauche/droite sur toute la hauteur de la page, bannière en haut du header, et nom du restaurant dans le `<title>` et le header.

**Critères d'acceptance :**
- [ ] Fetch `GET /api/site-config` dans le Server Component du layout (pas de fetch côté client)
- [ ] **Bordures latérales** : deux `<div>` fixes de largeur `4px` (ou configurable via Tailwind), positionnées `fixed left-0` et `fixed right-0`, pleine hauteur (`h-screen`), couleurs issues de `SiteConfig`
- [ ] **Bannière** : si `banniereUrl` renseignée, afficher `<img>` en haut du header (largeur 100%, hauteur max `200px`, `object-fit: cover`) ; sinon, aucun espace vide
- [ ] **Nom du restaurant** : injecté dans le `<title>` de la page via `generateMetadata` Next.js et affiché dans le header à la place de la valeur statique
- [ ] Si la config est absente (base vide), le layout fonctionne avec des valeurs par défaut (pas de crash)
- [ ] Aucune régression sur le layout existant (panier, navigation, footer inchangés)
- [ ] Les couleurs de bordure sont appliquées avec `style={{ backgroundColor: couleur }}` (inline) car les valeurs sont dynamiques — non purgeable par Tailwind

---

## Sprint 6 — Images produits, Upload bannière, Cache client RGPD (5,5 j)

### TICK-034 — API Upload d'images (Vercel Blob) ✅
**Épic :** Upload & Stockage
**Priorité :** 🔴 Bloquant
**Sizing :** 0,5 j
**Dépendances :** TICK-005, TICK-022

**Description :**
Créer `app/api/upload/route.ts` — route POST protégée admin pour uploader un fichier image vers Vercel Blob et retourner l'URL publique persistante.

**Critères d'acceptance :**
- [x] POST `/api/upload` : accepte un `FormData` avec un champ `file` (image uniquement)
- [x] Vérification du type MIME : `image/jpeg`, `image/png`, `image/webp`, `image/gif` uniquement — rejet HTTP 400 sinon
- [x] Taille maximale : 5 Mo — rejet HTTP 413 sinon
- [x] Upload via `@vercel/blob` : `put(filename, file, { access: 'public' })`
- [x] Retourne `{ url: string }` (URL Vercel Blob publique et permanente)
- [x] Route protégée par `getServerSession` (admin uniquement)
- [x] Variable d'env : `BLOB_READ_WRITE_TOKEN` (généré depuis Vercel Dashboard)
- [x] Ajout de `BLOB_READ_WRITE_TOKEN` dans `.env.local.example`

> **Ajout hors-spec (2026-03-19) :** Fallback développement local — si `BLOB_READ_WRITE_TOKEN` est absent, le fichier est sauvegardé dans `public/uploads/` et une URL relative `/uploads/<uuid>.<ext>` est retournée. Permet de tester sans compte Vercel. Le dossier `public/uploads/` est dans `.gitignore`.

---

### TICK-035 — Composant DropZone (réutilisable) ✅
**Épic :** Upload & Stockage
**Priorité :** 🔴 Bloquant
**Sizing :** 1,0 j
**Dépendances :** TICK-034

**Description :**
Créer `components/admin/DropZone.tsx` — composant générique d'upload d'image supportant le drag & drop et le clic pour ouvrir le sélecteur de fichier natif. Utilisé aussi bien pour les images produit que pour la bannière.

**Interface du composant :**
```typescript
interface DropZoneProps {
  currentImageUrl?: string       // URL de l'image existante (prévisualisation initiale)
  onUploadSuccess: (url: string) => void  // callback avec l'URL Vercel Blob
  onRemove?: () => void          // callback optionnel pour supprimer l'image
  label?: string                 // ex: "Image du produit", "Bannière"
  aspectRatio?: 'square' | 'banner'  // contrôle le ratio de prévisualisation
}
```

**Critères d'acceptance :**
- [x] Zone de drop avec bordure en tirets, texte indicatif "Glissez une image ici ou cliquez pour parcourir"
- [x] `<input type="file" accept="image/*" hidden>` déclenché au clic sur la zone
- [x] Gestion du drag : `dragover` → highlight de la zone, `dragleave` → retour normal, `drop` → upload
- [x] Upload immédiat au dépôt/sélection : POST `FormData` vers `/api/upload`
- [x] Indicateur de chargement pendant l'upload (spinner ou barre de progression)
- [x] Prévisualisation de l'image après upload réussi (`<img>` avec `object-fit: cover`)
- [x] Bouton "Supprimer l'image" (croix) sur la prévisualisation → appelle `onRemove` + efface la prévisualisation
- [x] Si `currentImageUrl` fourni à l'initialisation → prévisualisation affichée d'emblée
- [x] Message d'erreur inline si upload échoue (format non supporté, taille dépassée, erreur réseau)
- [x] `aspectRatio="square"` → prévisualisation carrée (produits) ; `aspectRatio="banner"` → ratio 16:3 (bannière)
- [x] Accessible : label associé à l'input, `aria-label` sur la zone de drop

---

### TICK-036 — Images produits : modèle + API ✅
**Épic :** Images produits
**Priorité :** 🟠 Haute
**Sizing :** 0,5 j
**Dépendances :** TICK-003, TICK-034

**Description :**
Ajouter le champ `imageUrl` au modèle `Produit` et mettre à jour les routes API pour le lire et l'écrire.

**Critères d'acceptance :**
- [x] `models/Produit.ts` : ajout du champ `imageUrl?: string` (optionnel) dans le schéma et l'interface `IProduit`
- [x] `GET /api/produits` : le champ `imageUrl` est inclus dans la réponse
- [x] `POST /api/produits` et `PUT /api/produits/[id]` : le champ `imageUrl` est accepté, validé par Zod comme `z.string().url().optional()`
- [x] Aucune migration nécessaire : les produits existants sans image fonctionnent normalement
- [x] `imageUrl` absent ou `null` → le produit est retourné sans ce champ (pas de valeur vide)

> **Note d'implémentation :** Le schéma Zod du `PUT` accepte également `null` (`z.string().url().optional().nullable()`) pour permettre la suppression d'une image existante via l'interface admin.

---

### TICK-037 — Images produits : formulaire admin (ProduitForm) ✅
**Épic :** Images produits
**Priorité :** 🟠 Haute
**Sizing :** 0,5 j
**Dépendances :** TICK-035, TICK-036, TICK-016

**Description :**
Intégrer le composant `DropZone` dans `components/admin/ProduitForm.tsx` pour permettre l'ajout, le remplacement et la suppression d'une image par produit.

**Critères d'acceptance :**
- [x] `DropZone` intégré sous les champs nom/description, avec `label="Image du produit"` et `aspectRatio="square"`
- [x] À l'upload réussi (`onUploadSuccess`) : `imageUrl` du formulaire mis à jour avec l'URL retournée
- [x] À la suppression (`onRemove`) : `imageUrl` remis à `null` dans le formulaire (envoyé à l'API pour effacer le champ en base)
- [x] En mode édition : si le produit a déjà un `imageUrl`, il est passé en `currentImageUrl` au composant DropZone
- [x] Le `imageUrl` est inclus dans le body du POST/PUT envoyé à l'API
- [x] Pas de double upload : si l'image n'a pas changé lors d'un PUT, `imageUrl` conserve l'URL existante

> **Écart spec :** `imageUrl` est `string | null` (non `undefined`) à la suppression — `null` est envoyé au PUT pour vider le champ MongoDB. Le POST filtre `null` → `undefined` avant envoi (`imageUrl: values.imageUrl || undefined`).

---

### TICK-038 — Images produits : affichage client (MenuCard) ✅
**Épic :** Images produits
**Priorité :** 🟠 Haute
**Sizing :** 0,5 j
**Dépendances :** TICK-036, TICK-010

**Description :**
Mettre à jour `components/client/MenuCard.tsx` pour afficher l'image du produit lorsqu'elle est disponible.

**Critères d'acceptance :**
- [x] Si `imageUrl` présent : affichage d'un `<Image>` Next.js en haut de la carte, ratio 4:3, `object-fit: cover`
- [x] Si `imageUrl` absent : aucun espace vide — layout sans image (comportement actuel)
- [x] Image lazy-loaded (`loading="lazy"`) pour ne pas pénaliser le LCP
- [x] Domaine Vercel Blob ajouté dans `next.config.ts` → `images.remotePatterns` (`*.public.blob.vercel-storage.com`)
- [x] Alt text = nom du produit
- [x] Pas de régression sur le layout existant (nom, description, prix, bouton "Ajouter" inchangés)
- [x] Responsive : image pleine largeur sur mobile, hauteur fixe sur desktop

> **Note :** Les images du fallback local (`/uploads/...`) sont servies depuis `public/` et ne nécessitent pas de `remotePatterns`.

---

### TICK-039 — Bannière : upload via DropZone (remplacement du champ URL) ✅
**Épic :** Personnalisation
**Priorité :** 🟠 Haute
**Sizing :** 0,5 j
**Dépendances :** TICK-035, TICK-032, TICK-033

**Description :**
Modifier `app/(admin)/personnalisation/page.tsx` pour remplacer le champ `<input type="url">` de la bannière par le composant `DropZone`. Le champ `banniereUrl` dans `SiteConfig` reste inchangé (il stocke toujours l'URL), mais l'URL est désormais obtenue par upload plutôt que saisie manuelle.

**Critères d'acceptance :**
- [x] Le champ `<input type="url">` de la bannière est remplacé par `<DropZone aspectRatio="banner" label="Bannière du site">`
- [x] Si `banniereUrl` existe en base : passé en `currentImageUrl` au composant DropZone (prévisualisation au chargement)
- [x] À l'upload réussi : `banniereUrl` du formulaire mis à jour avec l'URL retournée (Blob ou locale)
- [x] À la suppression : `banniereUrl` mis à `''` → PUT sauvegarde sans bannière → le layout client n'affiche plus la bannière
- [x] L'aperçu temps réel existant (`PersonnalisationApercu`) continue de fonctionner avec la nouvelle URL
- [x] Aucun changement sur `models/SiteConfig.ts` ni sur les routes API `GET/PUT /api/site-config`

---

### TICK-040 — Cache client RGPD (email + téléphone) ✅
**Épic :** Expérience client & RGPD
**Priorité :** 🟡 Moyenne
**Sizing :** 1,0 j
**Dépendances :** TICK-012, TICK-021

**Description :**
Permettre au client de sauvegarder son email et téléphone en `localStorage` pour pré-remplir les prochaines commandes, en respectant les exigences RGPD minimales : consentement explicite, information claire, suppression facile, et mention dans la politique de confidentialité.

**Comportement attendu :**

```
[Formulaire commande]
  └── Checkbox (non cochée par défaut) :
      "Mémoriser mes informations sur cet appareil pour mes prochaines commandes"
  └── Si cochée + submit réussi → localStorage.setItem('client_cache', { nom, telephone, email })
  └── Au chargement suivant : champs pré-remplis silencieusement

[Bouton "Effacer mes informations"]
  └── Affiché uniquement si un cache existe
  └── Vide localStorage + vide les champs + décoche la checkbox

[Texte informatif sous la checkbox]
  └── "Ces informations restent sur votre appareil et ne sont jamais transmises à nos serveurs."
```

**Critères d'acceptance :**
- [x] Nouvelle clé localStorage : `client_cache` → `{ nom: string, telephone: string, email?: string }` (JSON)
- [x] Checkbox `"Mémoriser mes informations sur cet appareil"` sous les champs client, **non cochée par défaut**
- [x] Texte informatif associé à la checkbox : `"Ces informations restent sur votre appareil et ne sont jamais transmises à nos serveurs."`
- [x] Si cache existant au chargement de la page : champs nom, téléphone, email pré-remplis **et** checkbox cochée automatiquement
- [x] Sauvegarde uniquement au submit du formulaire (pas en temps réel)
- [x] Si checkbox décochée au submit : supprimer le cache existant (`localStorage.removeItem('client_cache')`)
- [x] Bouton **"Effacer mes informations"** (visible uniquement si `client_cache` existe) : vide le cache, vide les champs, décoche la checkbox
- [x] Aucune donnée de cache envoyée au backend — les champs du formulaire restent la seule source de vérité pour le POST `/api/checkout`
- [x] Mise à jour de `app/(client)/mentions-legales/page.tsx` : ajout d'une section **"Données stockées localement"**
- [x] La checkbox et le bouton "Effacer" sont stylisés de manière cohérente avec le reste du formulaire (Tailwind)
- [x] Accessible : `<label>` associé à la checkbox, `aria-describedby` pointant vers le texte informatif

> **Note d'implémentation :** Les champs sont pré-remplis via `useRef` + `useEffect` (champs non-contrôlés) pour éviter les problèmes de SSR avec `localStorage`. La clé `client_cache` est lue uniquement côté client.

---

## Sprint 7 — Tests unitaires & intégration (7,0 j)

### TICK-041 — Infrastructure de test (Vitest + Testing Library + MSW)
**Épic :** Tests
**Priorité :** 🔴 Bloquant
**Sizing :** 0,5 j
**Dépendances :** TICK-001

**Description :**
Mettre en place l'outillage de test complet : Vitest comme runner (plus rapide que Jest, natif TypeScript/ESM), React Testing Library pour les composants, MSW pour le mock des routes API dans les tests composants, et `mongodb-memory-server` pour les tests de modèles Mongoose.

**Stack de test retenue :**

| Outil | Usage |
|-------|-------|
| `vitest` | Runner de tests, remplacement Jest |
| `@testing-library/react` | Rendu et assertions composants |
| `@testing-library/user-event` | Simulation interactions utilisateur |
| `@testing-library/jest-dom` | Matchers DOM supplémentaires (`toBeInTheDocument`, etc.) |
| `msw` (Mock Service Worker) | Mock des appels fetch dans les tests composants |
| `mongodb-memory-server` | Base MongoDB in-memory pour les tests de modèles |
| `@vitest/coverage-v8` | Rapport de couverture de code |

**Critères d'acceptance :**
- [ ] `vitest.config.ts` à la racine : environnement `jsdom`, alias `@/` → `./`, setup file `vitest.setup.ts`
- [ ] `vitest.setup.ts` : import `@testing-library/jest-dom/vitest`, configuration globale MSW
- [ ] `package.json` : scripts `test`, `test:watch`, `test:coverage`
- [ ] `__tests__/` à la racine (ou `*.test.ts` colocalisés) : convention documentée dans README
- [ ] Fichier `__mocks__/next/navigation.ts` : mock de `useRouter`, `useSearchParams`, `usePathname`
- [ ] Fichier `__mocks__/next-auth/react.ts` : mock de `useSession`, `signIn`, `signOut`
- [ ] `npm run test` exécute la suite sans erreur sur le projet vierge (0 tests = 0 failures)
- [ ] `npm run test:coverage` génère le rapport HTML dans `coverage/`
- [ ] Seuil de couverture cible documenté : **70 % lignes** pour `lib/`, `models/`, `app/api/`

---

### TICK-042 — Tests unitaires : utilitaires purs (`lib/creneaux.ts`, schémas Zod)
**Épic :** Tests
**Priorité :** 🟠 Haute
**Sizing :** 0,5 j
**Dépendances :** TICK-041, TICK-028

**Description :**
Tester exhaustivement les fonctions pures et les schémas de validation Zod. Ces tests sont les plus simples à écrire et couvrent une logique métier critique (génération des créneaux, validation des formulaires).

**Fichiers cibles :**
- `lib/creneaux.ts` → `__tests__/lib/creneaux.test.ts`
- Schémas Zod de `app/api/checkout/route.ts`, `app/api/produits/route.ts`, `app/api/site-config/route.ts`

**Critères d'acceptance :**

`lib/creneaux.ts` :
- [ ] Cas nominal : 12:00–14:00, pas 15 min → 8 créneaux exacts `["12:00 – 12:15", ..., "13:45 – 14:00"]`
- [ ] Cas : plage d'1 heure, pas 30 min → 2 créneaux
- [ ] Cas : `ouverture === fermeture` → tableau vide
- [ ] Cas : pas > plage totale → tableau vide
- [ ] Cas : valeurs limites (00:00–00:15, pas 15) → 1 créneau
- [ ] Invariant : dernier créneau se termine exactement à `fermeture`

Schémas Zod (validation) :
- [ ] Schéma produit : `prix` négatif → erreur Zod ; `nom` vide → erreur ; options malformées → erreur
- [ ] Schéma checkout : `produits` vide → erreur ; `client.telephone` absent → erreur ; `client.email` invalide → erreur
- [ ] Schéma site-config : couleur `"#ZZZZZZ"` → erreur ; couleur `"#E63946"` → valide ; chaîne vide → erreur
- [ ] Tous les schémas : cas valides passent sans erreur

---

### TICK-043 — Tests unitaires : modèles Mongoose
**Épic :** Tests
**Priorité :** 🟠 Haute
**Sizing :** 1,0 j
**Dépendances :** TICK-041, TICK-003, TICK-004, TICK-031

**Description :**
Tester les validations, valeurs par défaut et contraintes des trois modèles Mongoose via `mongodb-memory-server`. L'objectif est de vérifier que le schéma rejette les données invalides et accepte les données conformes, indépendamment de toute route API.

**Fichiers cibles :**
- `models/Produit.ts` → `__tests__/models/Produit.test.ts`
- `models/Commande.ts` → `__tests__/models/Commande.test.ts`
- `models/SiteConfig.ts` → `__tests__/models/SiteConfig.test.ts`

**Setup partagé :** `__tests__/helpers/mongoMemory.ts` — `beforeAll` connect, `afterEach` clear collections, `afterAll` disconnect.

**Critères d'acceptance :**

`Produit` :
- [ ] Sauvegarde valide : tous les champs obligatoires → document créé sans erreur
- [ ] `prix` négatif → `ValidationError`
- [ ] `nom` absent → `ValidationError`
- [ ] `actif` absent → valeur par défaut `true`
- [ ] `options` : sous-document avec `nom` et `prix` → sauvegardé correctement
- [ ] `imageUrl` absent → champ omis (pas de `null`)

`Commande` :
- [ ] `statut` valeur hors enum → `ValidationError`
- [ ] `stripeSessionId` dupliqué → erreur d'index unique (`E11000`)
- [ ] Snapshot produit : `produits[0].nom`, `prix`, `quantite` tous requis → `ValidationError` si absent
- [ ] `total` en centimes → nombre entier stocké tel quel

`SiteConfig` :
- [ ] `upsert: true` — deux appels `findOneAndUpdate` successifs → toujours 1 seul document en base
- [ ] `couleurBordureGauche` format invalide → `ValidationError` (regex `^#[0-9A-Fa-f]{6}$`)
- [ ] `updatedAt` mis à jour automatiquement à chaque `save`

---

### TICK-044 — Tests unitaires : API Routes produits
**Épic :** Tests
**Priorité :** 🟠 Haute
**Sizing :** 0,5 j
**Dépendances :** TICK-041, TICK-043, TICK-007

**Description :**
Tester les handlers des routes `app/api/produits/route.ts` et `app/api/produits/[id]/route.ts` en mockant Mongoose et `getServerSession`. Chaque test instancie le handler directement avec un objet `Request` synthétique.

**Fichiers cibles :**
- `__tests__/api/produits.test.ts`
- `__tests__/api/produits-id.test.ts`

**Mocks requis :** `lib/mongodb.ts` (no-op), `mongoose` (modèle `Produit` mocké), `next-auth` (`getServerSession`).

**Critères d'acceptance :**

`GET /api/produits` :
- [ ] Retourne 200 + liste des produits `actif: true`
- [ ] Ne retourne pas les produits `actif: false`
- [ ] Base vide → 200 + `[]`

`POST /api/produits` :
- [ ] Sans session → 401
- [ ] Body invalide (prix manquant) → 400 avec message Zod
- [ ] Body valide + session admin → 201 + document créé

`PUT /api/produits/[id]` :
- [ ] Sans session → 401
- [ ] ID inexistant → 404
- [ ] Mise à jour valide → 200 + document mis à jour

`PATCH /api/produits/[id]` (toggle actif) :
- [ ] Sans session → 401
- [ ] Toggle `actif` → valeur inversée retournée

`DELETE /api/produits/[id]` :
- [ ] Sans session → 401
- [ ] ID inexistant → 404
- [ ] Suppression réussie → 200

---

### TICK-045 — Tests unitaires : API Routes commandes & suivi
**Épic :** Tests
**Priorité :** 🟠 Haute
**Sizing :** 0,5 j
**Dépendances :** TICK-041, TICK-043, TICK-008, TICK-029

**Description :**
Tester les handlers des routes de lecture/mise à jour des commandes (admin) et de l'endpoint public de suivi.

**Fichiers cibles :**
- `__tests__/api/commandes.test.ts`
- `__tests__/api/commandes-statut.test.ts`
- `__tests__/api/commandes-suivi.test.ts`

**Critères d'acceptance :**

`GET /api/commandes` (admin) :
- [ ] Sans session → 401
- [ ] Avec session → 200 + liste triée par `createdAt` DESC

`PATCH /api/commandes/[id]/statut` :
- [ ] Sans session → 401
- [ ] Body `{ statut: "prete" }` valide → 200 + commande mise à jour
- [ ] Body `{ statut: "payee" }` (non autorisé via ce endpoint) → 400
- [ ] ID inexistant → 404

`GET /api/commandes/suivi?session_id=xxx` :
- [ ] `session_id` absent → 400
- [ ] `session_id` inconnu → 404
- [ ] Commande avec statut `"en_attente_paiement"` → 404
- [ ] Commande `"payee"` → 200 + réponse sans `client.telephone`, `client.email`, `stripeSessionId`
- [ ] Commande `"prete"` → 200 + `statut: "prete"`
- [ ] Champs sensibles absents de la réponse (vérification stricte de la shape)

---

### TICK-046 — Tests unitaires : API checkout & webhook Stripe
**Épic :** Tests
**Priorité :** 🔴 Bloquant
**Sizing :** 1,0 j
**Dépendances :** TICK-041, TICK-043, TICK-017, TICK-018

**Description :**
Tester le handler de création de session Stripe et le webhook. Ce sont les routes les plus critiques métier : un bug ici empêche toute commande ou crée des commandes fantômes. Stripe est mocké via `vi.mock('stripe')`.

**Fichiers cibles :**
- `__tests__/api/checkout.test.ts`
- `__tests__/api/webhook-stripe.test.ts`

**Critères d'acceptance :**

`POST /api/checkout` :
- [ ] Body invalide (produits vides) → 400
- [ ] Body valide → appel `stripe.checkout.sessions.create` avec les bons `line_items`
- [ ] `metadata` contient les infos client encodées
- [ ] Retourne `{ url: "https://checkout.stripe.com/..." }` (URL mockée)
- [ ] Erreur Stripe → 500 avec message d'erreur

`POST /api/webhooks/stripe` :
- [ ] Signature invalide → 400 (mock `stripe.webhooks.constructEvent` qui lève une erreur)
- [ ] Événement `payment_intent.created` (non géré) → 200 (silencieux)
- [ ] Événement `checkout.session.completed` :
  - [ ] Crée une `Commande` en base avec `statut: "payee"`
  - [ ] Appelle `sendConfirmationEmail` si `customer_email` présent dans la session
  - [ ] Ne crée **pas** d'email si `customer_email` absent
  - [ ] Idempotence : `stripeSessionId` déjà en base → retourne 200 sans créer de doublon
- [ ] Le handler retourne toujours HTTP 200 même si `sendConfirmationEmail` lève une exception (pas de crash)

---

### TICK-047 — Tests unitaires : API site-config & upload
**Épic :** Tests
**Priorité :** 🟡 Moyenne
**Sizing :** 0,5 j
**Dépendances :** TICK-041, TICK-043, TICK-031, TICK-034

**Description :**
Tester les routes de configuration de la vitrine et d'upload d'images, en mockant `@vercel/blob`.

**Fichiers cibles :**
- `__tests__/api/site-config.test.ts`
- `__tests__/api/upload.test.ts`

**Critères d'acceptance :**

`GET /api/site-config` :
- [ ] Aucun document en base → retourne les valeurs par défaut (`nomRestaurant: "Mon Restaurant"`)
- [ ] Document existant → retourne les valeurs sans `_id` ni `__v`

`PUT /api/site-config` :
- [ ] Sans session → 401
- [ ] Couleur invalide (`#ZZZ`) → 400 Zod
- [ ] Body valide → 200 + document upserted

`POST /api/upload` :
- [ ] Sans session → 401
- [ ] Fichier non-image (PDF) → 400
- [ ] Fichier > 5 Mo → 413
- [ ] Image JPEG valide → mock `@vercel/blob` appelé → retourne `{ url: "https://blob.vercel-storage.com/..." }`

---

### TICK-048 — Tests composants React : zone client
**Épic :** Tests
**Priorité :** 🟠 Haute
**Sizing :** 1,5 j
**Dépendances :** TICK-041, TICK-010, TICK-011, TICK-012, TICK-030

**Description :**
Tester les composants de la zone client avec React Testing Library. MSW intercepte les appels fetch pour simuler les réponses API. Le `localStorage` est réinitialisé entre chaque test.

**Fichiers cibles :**
- `__tests__/components/client/MenuCard.test.tsx`
- `__tests__/components/client/Panier.test.tsx`
- `__tests__/components/client/FormulaireCommande.test.tsx`
- `__tests__/components/client/ConfirmationSuivi.test.tsx`

**Critères d'acceptance :**

`MenuCard` :
- [ ] Rendu : nom, prix formaté en `€`, description affichés
- [ ] `imageUrl` présent → `<img>` rendu avec `alt` = nom du produit
- [ ] `imageUrl` absent → pas d'élément `<img>`
- [ ] Clic \"Ajouter\" → callback `onAjouter` appelé avec le bon produit
- [ ] Produit avec options → le composant de sélection d'option est rendu

`Panier` :
- [ ] Panier vide → bouton \"Commander\" désactivé
- [ ] Ajout d'un produit → total mis à jour en euros
- [ ] Modification quantité → recalcul du total
- [ ] Bouton \"Vider le panier\" → panier réinitialisé, `localStorage` vidé
- [ ] Rechargement simulé (`localStorage` pré-rempli) → panier restauré
- [ ] Clic \"Commander\" → navigation vers `/commande`

`FormulaireCommande` :
- [ ] Submit sans nom → message d'erreur Zod visible
- [ ] Téléphone format invalide → erreur Zod
- [ ] Type retrait `"creneau"` → `<select>` créneaux visible ; `"immediat"` → caché
- [ ] Submit valide → POST `/api/checkout` déclenché (intercepté par MSW)
- [ ] Erreur réseau checkout → message d'erreur affiché
- [ ] Checkbox \"Mémoriser\" cochée + submit → `localStorage.getItem('client_cache')` non nul
- [ ] Checkbox décochée + cache existant → cache supprimé au submit

`ConfirmationSuivi` (page suivi) :
- [ ] `session_id` absent → message d'erreur + lien retour menu visible
- [ ] Statut `"payee"` → bandeau \"En préparation\" visible, spinner/animation présent
- [ ] Statut `"prete"` → bandeau vert \"Commande prête\" visible, polling arrêté
- [ ] Panier `localStorage` vidé à l'arrivée sur la page
- [ ] Après 15s simulés (`vi.useFakeTimers`) → second appel MSW effectué

---

### TICK-049 — Tests composants React : zone admin
**Épic :** Tests
**Priorité :** 🟠 Haute
**Sizing :** 1,0 j
**Dépendances :** TICK-041, TICK-015, TICK-016, TICK-035, TICK-032

**Description :**
Tester les composants de l'espace admin. La session NextAuth est mockée avec un utilisateur admin valide.

**Fichiers cibles :**
- `__tests__/components/admin/CommandeRow.test.tsx`
- `__tests__/components/admin/ProduitForm.test.tsx`
- `__tests__/components/admin/DropZone.test.tsx`
- `__tests__/components/admin/PersonnalisationApercu.test.tsx`

**Critères d'acceptance :**

`CommandeRow` :
- [ ] Rendu : ID court, nom client, téléphone, total €, créneau, statut affichés
- [ ] Statut `"payee"` → bouton \"Marquer comme prête\" visible
- [ ] Statut `"prete"` → bouton absent
- [ ] Clic bouton → PATCH `/api/commandes/[id]/statut` déclenché (MSW) → callback `onStatutChange` appelé

`ProduitForm` :
- [ ] Mode création : champs vides, submit sans nom → erreur Zod
- [ ] Mode édition : champs pré-remplis depuis `produit` prop
- [ ] Ajout d'option dynamique → nouvelle ligne de champs visible
- [ ] Suppression d'option → ligne retirée
- [ ] Submit valide (création) → POST `/api/produits` déclenché
- [ ] Submit valide (édition) → PUT `/api/produits/[id]` déclenché

`DropZone` :
- [ ] Rendu initial sans `currentImageUrl` → zone de drop avec texte indicatif, pas d'`<img>`
- [ ] `currentImageUrl` fourni → image prévisualisée dès le rendu
- [ ] Clic sur la zone → `<input type="file">` déclenché (simulé avec `userEvent`)
- [ ] Sélection fichier valide → POST `/api/upload` déclenché (MSW) → `onUploadSuccess` appelé avec l'URL
- [ ] Sélection fichier invalide (MSW retourne 400) → message d'erreur inline visible
- [ ] Clic bouton supprimer → `<img>` retiré, `onRemove` appelé
- [ ] Drag & drop : `dragover` → classe CSS de highlight ; `drop` → upload déclenché

`PersonnalisationApercu` :
- [ ] Props `couleurGauche="#E63946"` → `<div>` gauche a `backgroundColor: "#E63946"` en style inline
- [ ] `banniereUrl` fourni → `<img>` bannière visible
- [ ] `banniereUrl` absent → pas d'`<img>` bannière
- [ ] `nomRestaurant` → texte affiché dans l'aperçu

---

## Sprint 8 — Sécurité & RGPD (6,5 j)

> Issu de l'audit sécurité & RGPD réalisé le 2026-03-20. TICK-050 est bloquant avant toute mise en production.

---

### TICK-050 — Validation des prix produits côté serveur lors du checkout
**Épic :** Sécurité applicative
**Priorité :** 🔴 Bloquant
**Sizing :** 1,0 j
**Dépendances :** TICK-003, TICK-017

**Description :**
L'API `/api/checkout` accepte les prix depuis le corps de la requête sans les vérifier en base de données. Un client peut manipuler les prix dans le body POST et payer n'importe quel montant (ex : 0,01 € pour un produit à 8,50 €). C'est la vulnérabilité la plus critique du projet.

**Référence audit :** SEC-01 — OWASP A04:2021 Insecure Design

**Critères d'acceptance :**
- [ ] Lors du POST `/api/checkout`, récupérer chaque `produitId` depuis MongoDB (`Produit.find(...)`)
- [ ] Utiliser `produitDB.prix` comme référence de prix — ignorer la valeur `prix` fournie par le client
- [ ] Valider que chaque option envoyée existe dans `produitDB.options[]` et utiliser `optionDB.prix`
- [ ] Retourner 400 si un `produitId` est invalide ou le produit inactif/introuvable
- [ ] Recalculer le total côté serveur avant envoi à Stripe
- [ ] Adapter le mode mock en conséquence (même logique, sans appel Stripe)
- [ ] Test : un body avec `prix: 1` doit créer une session Stripe au prix réel de la BDD
- [ ] Test : un `produitId` inexistant → 400

---

### TICK-051 — Ajout des headers de sécurité HTTP
**Épic :** Sécurité applicative
**Priorité :** 🟠 Haute
**Sizing :** 0,5 j
**Dépendances :** TICK-001

**Description :**
Aucun header de sécurité HTTP n'est configuré. L'application est exposée sans Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, ni Referrer-Policy.

**Référence audit :** SEC-02 — OWASP A05:2021 Security Misconfiguration

**Critères d'acceptance :**
- [ ] Configurer `headers()` dans `next.config.ts` s'appliquant à toutes les routes `/(.*)`
- [ ] `X-Frame-Options: DENY` — protection clickjacking
- [ ] `X-Content-Type-Options: nosniff` — protection MIME sniffing
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- [ ] `Content-Security-Policy` minimal (autoriser `unsafe-inline` temporairement pour Tailwind si nécessaire)
- [ ] Vérifier le score avec [securityheaders.com](https://securityheaders.com) après déploiement — score A minimum
- [ ] Aucune régression sur le fonctionnement des pages

---

### TICK-052 — Rate limiting sur l'endpoint de login admin
**Épic :** Sécurité applicative
**Priorité :** 🟠 Haute
**Sizing :** 1,0 j
**Dépendances :** TICK-005

**Description :**
L'endpoint NextAuth credentials `/api/auth/callback/credentials` peut être soumis à une attaque par force brute sans aucune protection. Un attaquant peut tenter des milliers de mots de passe sans délai ni blocage.

**Référence audit :** SEC-03 — OWASP A07:2021 Identification and Authentication Failures

**Critères d'acceptance :**
- [ ] Maximum 10 tentatives par IP sur une fenêtre glissante de 15 minutes
- [ ] Réponse 429 avec header `Retry-After` en cas de dépassement
- [ ] Utiliser `@upstash/ratelimit` avec Redis Upstash (plan gratuit) en production
- [ ] Fallback `Map` in-memory acceptable en développement (documenté)
- [ ] Logger les tentatives bloquées avec l'IP (`x-forwarded-for`)
- [ ] Test : 11 tentatives consécutives → la 11ème retourne 429

---

### TICK-053 — Validation MIME par magic bytes pour l'upload d'images
**Épic :** Sécurité applicative
**Priorité :** 🟠 Haute
**Sizing :** 0,5 j
**Dépendances :** TICK-034

**Description :**
La validation MIME actuelle dans `/api/upload` repose sur `file.type`, un champ fourni par le navigateur (en-tête Content-Type de la partie multipart). Il est trivial de déposer un fichier malveillant avec `Content-Type: image/jpeg`.

**Référence audit :** SEC-04 — OWASP A03:2021 Injection, CWE-434

**Critères d'acceptance :**
- [ ] Installer la librairie `file-type` (pure ESM, compatible Edge/Node)
- [ ] Lire le buffer du fichier et détecter le type réel via les magic bytes (`fileTypeFromBuffer`)
- [ ] Rejeter tout fichier dont le type détecté ne correspond pas à la liste blanche (`image/jpeg`, `image/png`, `image/webp`, `image/gif`)
- [ ] Sanitiser le nom de fichier avant envoi à Vercel Blob : utiliser le `randomUUID()` déjà présent en mode local — appliquer la même logique en mode production (`put(randomUUID() + '.' + ext, file, ...)`)
- [ ] Test : un fichier `.php` renommé `.jpg` → rejeté (400)
- [ ] Test : un vrai JPEG → accepté

---

### TICK-054 — Étendre le middleware aux routes API admin manquantes
**Épic :** Sécurité applicative
**Priorité :** 🟡 Moyenne
**Sizing :** 0,5 j
**Dépendances :** TICK-005

**Description :**
Plusieurs routes admin reposent uniquement sur `getServerSession` dans le handler, sans filet de sécurité au niveau middleware : `/api/produits` (POST/PUT/PATCH/DELETE), `/api/upload`, `/api/site-config` (PUT). Si un bug introduit un bypass de `getServerSession` lors d'un refactor, ces routes seront ouvertes sans protection de niveau middleware.

**Référence audit :** SEC-06 — OWASP A01:2021 Broken Access Control

**Critères d'acceptance :**
- [ ] Ajouter dans le `matcher` de `middleware.ts` : `/api/produits` (POST/PUT/PATCH/DELETE), `/api/upload`, `/api/site-config` (méthodes mutantes)
- [ ] `GET /api/produits` reste public (non inclus dans le matcher ou exclu par méthode HTTP)
- [ ] `GET /api/site-config` reste public
- [ ] Vérifier que les tests existants passent toujours (TICK-044, TICK-047)
- [ ] Documenter dans un commentaire les routes publiques intentionnelles

---

### TICK-055 — Sécuriser le mode mock checkout (staging/dev only)
**Épic :** Sécurité applicative
**Priorité :** 🟡 Moyenne
**Sizing :** 0,5 j
**Dépendances :** TICK-017

**Description :**
La route `/api/mock-checkout` et la page `/mock-checkout` ne doivent jamais être actives en production. La protection actuelle repose uniquement sur l'absence de `STRIPE_SECRET_KEY`, ce qui est fragile. De plus, `mockSessions` est un Map global sans TTL pouvant s'accumuler indéfiniment.

**Référence audit :** SEC-07

**Critères d'acceptance :**
- [ ] Ajouter un double guard `NODE_ENV !== 'production'` sur la route `/api/mock-checkout` (en plus du check `STRIPE_SECRET_KEY`)
- [ ] Implémenter un TTL de 30 minutes sur les entrées `mockSessions` : stocker `{ data, expiresAt }` et nettoyer les sessions expirées à chaque lecture
- [ ] Documenter la variable `STRIPE_SECRET_KEY` comme le gate principal dans `.env.local.example`
- [ ] Test : en mode production simulé (`NODE_ENV=production`) → la route retourne 403

---

### TICK-056 — Mise en conformité du bandeau cookie (CNIL)
**Épic :** Conformité RGPD
**Priorité :** 🟠 Haute
**Sizing :** 0,5 j
**Dépendances :** TICK-021

**Description :**
Le bandeau cookie actuel (`CookieBanner.tsx`) propose uniquement un bouton "Continuer". L'absence d'un bouton "Refuser" n'est pas conforme aux lignes directrices de la CNIL (délibération 2020-091) : le refus doit être aussi facile que l'acceptation.

**Référence audit :** RGPD-01 — RGPD Art. 7, Guidelines CNIL 2022

**Critères d'acceptance :**
- [ ] Ajouter un bouton "Refuser" (ou "Continuer sans accepter") de même visibilité visuelle que "Continuer" (même taille, même contraste)
- [ ] Stocker `'refused'` dans `localStorage['cookie_consent']` en cas de refus (le bandeau ne réapparaît plus)
- [ ] Préciser dans le texte du bandeau que le cookie de session admin est strictement nécessaire (donc exempté de consentement)
- [ ] Mettre à jour la page `/mentions-legales` : section cookies cohérente avec le comportement du bandeau
- [ ] Test : clic "Refuser" → bandeau disparaît, `localStorage.getItem('cookie_consent') === 'refused'`

---

### TICK-057 — Politique de rétention et droit à l'effacement des données commandes
**Épic :** Conformité RGPD
**Priorité :** 🟡 Moyenne
**Sizing :** 1,0 j
**Dépendances :** TICK-004, TICK-008

**Description :**
Les données personnelles des commandes (nom, téléphone, email) sont stockées sans durée de conservation définie ni mécanisme de suppression. La RGPD impose une durée limitée et l'implémentation du droit à l'effacement (Art. 17).

**Référence audit :** RGPD-02 — RGPD Art. 5(1)(e) et Art. 17

**Critères d'acceptance :**
- [ ] Définir une durée de rétention de 12 mois (obligation comptable légale)
- [ ] Ajouter le champ `purgeAt: Date` sur le modèle `Commande` (calculé à `createdAt + 12 mois`)
- [ ] Implémenter `DELETE /api/commandes/[id]` (admin) : suppression physique ou anonymisation des PII (`client.nom`, `client.telephone`, `client.email`)
- [ ] Ajouter le bouton "Supprimer" dans `CommandeRow` admin (avec confirmation), réservé aux commandes `"prete"` uniquement
- [ ] Documenter la durée de rétention dans `/mentions-legales` (section "Données personnelles")
- [ ] Test : DELETE `/api/commandes/[id]` sans session → 401 ; avec session → 200, données supprimées

---

### TICK-058 — Documenter les transferts de données vers les sous-traitants (mentions légales)
**Épic :** Conformité RGPD
**Priorité :** 🟡 Moyenne
**Sizing :** 0,5 j
**Dépendances :** TICK-021

**Description :**
Les données personnelles (nom, téléphone, email) sont transmises à Stripe (USA) via les métadonnées de la session Checkout. Vercel, MongoDB Atlas et Resend sont également des sous-traitants. Ces transferts doivent être documentés dans les mentions légales.

**Référence audit :** RGPD-03 — RGPD Art. 28 et Art. 44

**Critères d'acceptance :**
- [ ] Ajouter une section "Sous-traitants" dans `/mentions-legales` listant : Stripe (paiement, USA — Data Privacy Framework), Vercel (hébergement, USA — DPA disponible), MongoDB Atlas (base de données, USA — DPA disponible), Resend (email, USA)
- [ ] Lien vers les DPA de chaque sous-traitant (pages publiques de leurs sites)
- [ ] Mentionner que Stripe est signataire du Data Privacy Framework (transfert légalement encadré)
- [ ] Évaluer la possibilité de retirer `client_email` des métadonnées Stripe si non indispensable au webhook (minimisation des données)

---

### TICK-059 — Logs de sécurité structurés
**Épic :** Sécurité applicative
**Priorité :** 🟢 Basse
**Sizing :** 1,0 j
**Dépendances :** TICK-001

**Description :**
Les erreurs sont actuellement loguées via `console.error` sans structure. En cas d'incident de sécurité, le forensic est impossible (pas de trace ID, pas d'IP, pas de niveau de sévérité).

**Référence audit :** SEC-09 — OWASP A09:2021 Security Logging and Monitoring Failures

**Critères d'acceptance :**
- [ ] Créer `lib/logger.ts` : wrapper léger avec niveaux (`info`, `warn`, `error`) et timestamp ISO
- [ ] Logguer tous les événements 401/403 avec l'IP (`x-forwarded-for` ou `req.ip`) et la route concernée
- [ ] Logguer les erreurs webhook Stripe avec `stripeSessionId` (sans données personnelles)
- [ ] Logguer les tentatives d'upload refusées (type MIME invalide, taille dépassée) avec IP
- [ ] En production : intégrer avec Vercel Log Drain ou un service externe (Axiom, Logtail — plans gratuits disponibles)
- [ ] Remplacer progressivement les `console.error` des routes API par le nouveau logger

---

## Sprint 9 — Corrections post-audit Sprint 8 (2,5 j)

> Issu du second audit réalisé le 2026-03-20 après implémentation du Sprint 8. Ces tickets corrigent des lacunes découvertes dans le code implémenté.

---

### TICK-060 — Ajouter l'index TTL MongoDB sur `purgeAt` et logger les anonymisations
**Épic :** Conformité RGPD
**Priorité :** 🔴 Bloquant
**Sizing :** 0,5 j
**Dépendances :** TICK-057

**Contexte :**
TICK-057 a ajouté le champ `purgeAt` sur le modèle `Commande` et la page `/mentions-legales` promet que « les informations personnelles sont automatiquement anonymisées » après 12 mois. Mais **l'index TTL MongoDB est absent** du schéma Mongoose — MongoDB ne supprimera donc jamais rien automatiquement. C'est une non-conformité RGPD active.

De plus, les anonymisations manuelles via `DELETE /api/commandes/[id]` ne sont pas loggées, ce qui rend impossible tout audit RGPD.

**Référence audit :** NEW-01, NEW-06 — RGPD Art. 5(1)(e), Art. 5(2)

**Correction exacte — Fichier `3gsolutionapp/models/Commande.ts`**

Après la définition du `CommandeSchema` (actuellement ligne ~87), ajouter avant l'export :

```typescript
// TICK-060 — RGPD Art. 5(1)(e) : index TTL MongoDB pour suppression automatique
// expireAfterSeconds: 0 → MongoDB supprime le document dès que Date.now() >= purgeAt
CommandeSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });
```

**Correction exacte — Fichier `3gsolutionapp/app/api/commandes/[id]/route.ts`**

Ajouter l'import du logger en haut du fichier :
```typescript
import { logger } from '@/lib/logger';
```

Remplacer le `console.error` final par `logger.error` :
```typescript
// Avant
console.error('Erreur suppression commande:', error);
// Après
logger.error('anonymisation_failed', { commandeId: id }, error);
```

Ajouter un log de succès juste avant le `return NextResponse.json({ ok: true })` :
```typescript
logger.info('commande_anonymisee', { commandeId: id });
return NextResponse.json({ ok: true });
```

**Critères d'acceptance :**
- [ ] `CommandeSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 })` présent dans `models/Commande.ts`
- [ ] Vérifier dans MongoDB Atlas que l'index TTL `purgeAt_1` apparaît bien sur la collection `commandes` après déploiement (`db.commandes.getIndexes()`)
- [ ] `logger` importé dans `app/api/commandes/[id]/route.ts`
- [ ] Anonymisation réussie → log `commande_anonymisee` avec `commandeId`
- [ ] Erreur lors de l'anonymisation → log `anonymisation_failed` avec `commandeId` et message d'erreur
- [ ] Aucun `console.error` résiduel dans ce fichier

---

### TICK-061 — Supprimer `unsafe-eval` de la CSP en production
**Épic :** Sécurité applicative
**Priorité :** 🟠 Haute
**Sizing :** 0,5 j
**Dépendances :** TICK-051

**Contexte :**
TICK-051 a configuré les headers HTTP mais la CSP contient `'unsafe-eval'` dans `script-src`. Cette directive autorise `eval()`, `Function(string)` et `setTimeout(string)` — les vecteurs d'exploitation XSS les plus courants. Une CSP avec `unsafe-eval` est quasiment inutile contre les attaques par injection de scripts.

Le commentaire dit « requis Next.js dev/prod » mais ce n'est vrai qu'en développement Turbopack (HMR). En production, le build Next.js génère des bundles statiques qui n'ont pas besoin d'`eval()`.

**Référence audit :** NEW-02 — OWASP A05:2021

**Correction exacte — Fichier `3gsolutionapp/next.config.ts`**

Remplacer la ligne `script-src` actuelle :
```typescript
// Avant
"script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-eval requis Next.js dev/prod

// Après
process.env.NODE_ENV === 'development'
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"  // Turbopack HMR en dev
  : "script-src 'self' 'unsafe-inline'",               // Production : pas d'eval()
```

Pour ce faire, la valeur CSP doit être construite dynamiquement. Transformer le tableau de strings en fonction :

```typescript
async headers() {
  const isDev = process.env.NODE_ENV === 'development';
  const csp = [
    "default-src 'self'",
    isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com",
    "font-src 'self'",
    "connect-src 'self' https://api.stripe.com",
    "frame-src https://js.stripe.com https://hooks.stripe.com",
    "worker-src 'self' blob:",
  ].join('; ');

  return [{
    source: '/(.*)',
    headers: [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Content-Security-Policy', value: csp },
    ],
  }];
}
```

**Critères d'acceptance :**
- [ ] En `NODE_ENV=development` : la CSP contient `unsafe-eval` (Turbopack fonctionne)
- [ ] En `NODE_ENV=production` : la CSP ne contient **pas** `unsafe-eval`
- [ ] Vérifier que le build de production (`next build`) ne génère pas d'erreurs liées à `eval()` dans la console navigateur
- [ ] Vérifier que les pages client, admin et le Service Worker PWA fonctionnent correctement en production
- [ ] Scorer A ou A+ sur [securityheaders.com](https://securityheaders.com) après déploiement

---

### TICK-062 — Middleware : couvrir `DELETE /api/commandes/[id]` et durcir la détection d'IP
**Épic :** Sécurité applicative
**Priorité :** 🟡 Moyenne
**Sizing :** 0,5 j
**Dépendances :** TICK-054, TICK-052

**Contexte :**
Deux lacunes dans `middleware.ts` :

1. **Route DELETE absente du matcher** : `DELETE /api/commandes/[id]` (route d'anonymisation RGPD, TICK-057) n'est pas dans le matcher. Le handler vérifie `getServerSession`, mais la défense en profondeur établie par TICK-054 n'est pas appliquée ici.

2. **IP spoofable pour le rate limiting** : le header `x-forwarded-for` est lu sans vérification. Un attaquant peut envoyer `X-Forwarded-For: 1.2.3.4, 5.6.7.8` avec une IP différente à chaque requête pour contourner le rate limiting. Sur Vercel Edge, `request.ip` donne la vraie IP (non spoofable).

**Référence audit :** NEW-03 (OWASP A01:2021), NEW-04 (contournement rate limit)

**Correction exacte — Fichier `3gsolutionapp/middleware.ts`**

**Fix 1 — Ajouter la route DELETE au matcher :**
```typescript
// Dans l'objet config.matcher, ajouter :
'/api/commandes/:id',   // DELETE anonymisation RGPD (TICK-060)
```

Le matcher complet devient :
```typescript
matcher: [
  '/admin/commandes/:path*',
  '/admin/menu/:path*',
  '/admin/personnalisation/:path*',
  '/api/commandes',
  '/api/commandes/:id/statut',
  '/api/commandes/:id',        // ← TICK-062 : DELETE anonymisation
  '/api/upload',
  '/api/site-config',
  '/api/auth/callback/credentials',
],
```

**Fix 2 — Utiliser `request.ip` en priorité pour le rate limiting :**
```typescript
// Avant
const ip =
  request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
  request.headers.get('x-real-ip') ??
  '127.0.0.1';

// Après
const ip =
  (request as NextRequest & { ip?: string }).ip ??          // Vercel Edge (non spoofable)
  request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
  request.headers.get('x-real-ip') ??
  '127.0.0.1';
```

**Critères d'acceptance :**
- [ ] `/api/commandes/:id` présent dans `config.matcher`
- [ ] `DELETE /api/commandes/invalid-id` sans token JWT → 401 (renvoyé par le middleware, pas le handler)
- [ ] `request.ip` utilisé en priorité dans la logique de détection d'IP du rate limiting
- [ ] Les tests existants TICK-045 passent toujours (la route GET `/api/commandes/suivi` reste publique)

---

### TICK-063 — Rate limiting : remplacer le fail-open par un fallback in-memory en cas de panne Upstash
**Épic :** Sécurité applicative
**Priorité :** 🟡 Moyenne
**Sizing :** 0,5 j
**Dépendances :** TICK-052

**Contexte :**
Dans `lib/ratelimit.ts`, si Upstash Redis est indisponible en production, le catch silencieux retourne `{ success: true }` — le rate limiting s'ouvre complètement. Un attaquant qui provoquerait une saturation Redis (ou qui attendrait une fenêtre de maintenance Upstash) pourrait déclencher une attaque brute force sans limitation.

**Référence audit :** NEW-05 — OWASP A07:2021

**Correction exacte — Fichier `3gsolutionapp/lib/ratelimit.ts`**

Remplacer le `catch` du bloc Upstash :

```typescript
// Avant
} catch (err) {
  // Dégradation gracieuse : si Upstash est indisponible, on laisse passer
  console.error('[ratelimit] Upstash indisponible, fallback permissif:', err);
  return { success: true, remaining: MAX_REQUESTS, reset: 0 };
}

// Après
} catch (err) {
  // Dégradation vers le fallback in-memory plutôt que fail-open
  // Préférable à "laisser passer" : la protection reste active même si Redis tombe
  console.error('[ratelimit] Upstash indisponible, fallback in-memory activé:', err);
  return inMemoryRateLimit(ip);
}
```

**Critères d'acceptance :**
- [ ] En cas d'exception Upstash, `inMemoryRateLimit(ip)` est appelé (pas `{ success: true }`)
- [ ] Le log d'avertissement indique explicitement « fallback in-memory » (pas « fallback permissif »)
- [ ] Test : simuler une panne Upstash (variable d'env invalide) → le rate limiting in-memory s'active et bloque après 10 tentatives

---

### TICK-064 — Corriger les `console.*` résiduels et valider les métadonnées webhook avec Zod
**Épic :** Qualité & sécurité
**Priorité :** 🟢 Basse
**Sizing :** 0,5 j
**Dépendances :** TICK-059

**Contexte :**
Deux problèmes mineurs hors du logger structuré mis en place par TICK-059 :

1. **`console.error` résiduel dans `app/api/mock-checkout/route.ts`** : le handler mock utilise encore `console.error` au lieu de `logger.error`. En production, ces logs ne seront pas en JSON structuré.

2. **Métadonnées webhook non validées** : dans `app/api/webhooks/stripe/route.ts`, `JSON.parse(metadata.produits ?? '[]')` parse les données sans validation Zod. Si les métadonnées sont corrompues (édition manuelle dans le dashboard Stripe, truncature à 500 chars par l'API Stripe), le webhook plante silencieusement et la commande n'est jamais créée.

**Référence audit :** NEW-07, NEW-08

**Correction 1 — Fichier `3gsolutionapp/app/api/mock-checkout/route.ts`**

Ajouter l'import du logger :
```typescript
import { logger } from '@/lib/logger';
```

Remplacer le `console.error` :
```typescript
// Avant
console.error('Mock checkout error:', error);

// Après
logger.error('mock_checkout_failed', { sessionId }, error);
```

**Correction 2 — Fichier `3gsolutionapp/app/api/webhooks/stripe/route.ts`**

Ajouter un schéma Zod pour valider les produits extraits des métadonnées Stripe. Ajouter en haut du fichier (après les imports existants) :

```typescript
import { z } from 'zod';

const ProduitMetadataSchema = z.array(z.object({
  produitId: z.string(),
  nom: z.string(),
  prix: z.number().int().min(0),
  quantite: z.number().int().min(1),
  options: z.array(z.object({
    nom: z.string(),
    prix: z.number().int().min(0),
  })).default([]),
}));
```

Remplacer le `JSON.parse` brut :
```typescript
// Avant
const produits: ProduitPayload[] = JSON.parse(metadata.produits ?? '[]');

// Après
const parseResult = ProduitMetadataSchema.safeParse(
  JSON.parse(metadata.produits ?? '[]')
);
if (!parseResult.success) {
  logger.error('webhook_invalid_produits_metadata', {
    stripeSessionId: session.id,
  });
  // On répond 200 pour ne pas déclencher les retries Stripe sur données corrompues
  return NextResponse.json({ received: true });
}
const produits = parseResult.data;
```

**Critères d'acceptance :**
- [ ] `app/api/mock-checkout/route.ts` : aucun `console.error`, utilise `logger.error('mock_checkout_failed', ...)`
- [ ] `app/api/webhooks/stripe/route.ts` : `ProduitMetadataSchema` défini avec Zod
- [ ] Métadonnées valides → commande créée normalement
- [ ] Métadonnées corrompues (`produits: "invalid_json"`) → log `webhook_invalid_produits_metadata` + réponse 200 (pas de retry Stripe)
- [ ] Les tests existants TICK-046 (`webhook-stripe.test.ts`) passent toujours

---

## Sprint 10 — Compte Client : Auth, Inscription & Profil (8,0 j)

### TICK-065 — Modèle Mongoose : Client
**Épic :** Modèles de données
**Priorité :** 🔴 Bloquant
**Sizing :** 0,5 j
**Dépendances :** TICK-002

**Description :**
Créer `models/Client.ts` avec le schéma complet du compte client.

**Critères d'acceptance :**
- [ ] Champs : `email` (unique, indexé), `nom?`, `passwordHash?`, `provider: "credentials" | "google"`, `emailVerified: boolean`, `emailVerifyToken?`, `emailVerifyTokenExpiry?`, `passwordResetToken?`, `passwordResetTokenExpiry?`, `role: "client"`, `createdAt`, `updatedAt`
- [ ] Interface TypeScript `IClient` exportée
- [ ] `email` : index unique, lowercase, trim
- [ ] `role` : valeur par défaut `"client"` (non modifiable)
- [ ] Export avec guard `mongoose.models.Client || mongoose.model(...)`

---

### TICK-066 — Extension NextAuth : Google + credentials client
**Épic :** Auth client
**Priorité :** 🔴 Bloquant
**Sizing :** 1,0 j
**Dépendances :** TICK-065, TICK-005

**Description :**
Étendre `lib/auth.ts` pour ajouter le provider Google et un second provider Credentials pour les clients. Ajouter le champ `role` dans le JWT et la session.

**Critères d'acceptance :**
- [ ] Provider `GoogleProvider` ajouté avec `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET`
- [ ] Second `CredentialsProvider` (id: `"client-credentials"`) : vérifie email + mdp en base Client, bloque si `emailVerified: false` (message explicite)
- [ ] Callback `jwt` : injecte `token.role = user.role` (admin credentials) ou `"client"` (Google + client credentials)
- [ ] Callback `session` : expose `session.user.role` et `session.user.id`
- [ ] "Se souvenir de moi" : champ `rememberMe` passé dans credentials, `maxAge: rememberMe ? 2592000 : 86400`
- [ ] Types TypeScript étendus (`next-auth.d.ts`) pour `session.user.role` et `session.user.id`
- [ ] Google → upsert Client (email unique, `provider: "google"`, `emailVerified: true`) ; si email déjà en base avec `provider: "credentials"` → erreur explicite (pas de fusion)
- [ ] `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` ajoutés dans `.env.local.example`
- [ ] Route `/api/auth/[...nextauth]` configurée avec callback URL whitelist incluant `/profil`

---

### TICK-067 — API inscription client (POST /api/client/register)
**Épic :** Auth client
**Priorité :** 🔴 Bloquant
**Sizing :** 1,0 j
**Dépendances :** TICK-065, TICK-078

**Description :**
Créer `app/api/client/register/route.ts`. Validation Zod stricte, hash bcrypt, envoi email de vérification via Resend.

**Schéma Zod :**
```typescript
const RegisterSchema = z.object({
  email: z.string().email('Email invalide'),
  nom: z.string().min(1).max(50).optional(),
  password: z.string()
    .min(8, 'Minimum 8 caractères')
    .regex(/[A-Z]/, 'Au moins 1 majuscule')
    .regex(/[a-z]/, 'Au moins 1 minuscule')
    .regex(/[0-9]/, 'Au moins 1 chiffre')
    .regex(/[^A-Za-z0-9]/, 'Au moins 1 caractère spécial'),
});
```

**Critères d'acceptance :**
- [ ] `POST /api/client/register` public (pas d'auth requise)
- [ ] Validation Zod → 400 si invalide avec messages d'erreur par champ
- [ ] Email déjà existant → 409 avec message *"Un compte existe déjà avec cet email."*
- [ ] Hash bcrypt (12 rounds) du mot de passe
- [ ] Token de vérification : `crypto.randomBytes(32).toString('hex')`, expiry `Date.now() + 24h`
- [ ] Insert Client avec `emailVerified: false`, token stocké
- [ ] Email envoyé via Resend : lien `${NEXTAUTH_URL}/auth/verify-email?token=xxx` valide 24h
- [ ] Réponse `201` sans exposer le hash ni le token
- [ ] Logger `client_register_attempt` et `client_register_success` via `lib/logger.ts`

---

### TICK-068 — API vérification email (POST /api/client/verify-email)
**Épic :** Auth client
**Priorité :** 🔴 Bloquant
**Sizing :** 0,5 j
**Dépendances :** TICK-065, TICK-067

**Description :**
Créer `app/api/client/verify-email/route.ts`. Confirmer le token, activer le compte.

**Critères d'acceptance :**
- [ ] `POST /api/client/verify-email` avec body `{ token: string }` — route publique
- [ ] Rechercher le Client par `emailVerifyToken`
- [ ] Token expiré → 400 *"Lien de vérification expiré. Veuillez vous réinscrire."* + suppression du compte (token inutilisable)
- [ ] Token valide → `emailVerified: true`, `emailVerifyToken: undefined`, `emailVerifyTokenExpiry: undefined`
- [ ] Réponse 200 avec message de succès
- [ ] Token inexistant → 400 (message générique, pas d'info sur l'existence du compte)
- [ ] Page `/auth/verify-email` appelle l'API au chargement via `useEffect` et affiche loading/succès/erreur

---

### TICK-069 — API réinitialisation de mot de passe
**Épic :** Auth client
**Priorité :** 🟠 Haute
**Sizing :** 0,5 j
**Dépendances :** TICK-065, TICK-078

**Description :**
Créer deux routes : `POST /api/client/forgot-password` (envoi email) et `POST /api/client/reset-password` (application nouveau mdp).

**Critères d'acceptance :**

`POST /api/client/forgot-password` :
- [ ] Retourne toujours `200` (évite l'énumération d'emails)
- [ ] Si compte `credentials` existe : générer token `crypto.randomBytes(32)`, expiry +1h, envoyer email Resend
- [ ] Si compte `google` ou inexistant : pas d'email envoyé, réponse identique (200)
- [ ] Logger `password_reset_requested` (sans exposer l'email dans les logs en prod)

`POST /api/client/reset-password` :
- [ ] Body : `{ token: string, password: string }` — validation Zod mot de passe fort
- [ ] Token inexistant ou expiré → 400
- [ ] Token valide → hash bcrypt + update `passwordHash`, supprimer `passwordResetToken` + `passwordResetTokenExpiry`
- [ ] Réponse 200, redirection côté client vers `/auth/login`
- [ ] Logger `password_reset_success`

---

### TICK-070 — Pages auth client (login, register, verify-email, forgot-password, reset-password)
**Épic :** Auth client
**Priorité :** 🔴 Bloquant
**Sizing :** 2,0 j
**Dépendances :** TICK-066, TICK-067, TICK-068, TICK-069

**Description :**
Créer les 5 pages du tunnel d'authentification client dans `app/(client)/auth/`.

**Page `/auth/login` :**
- [ ] Bouton "Continuer avec Google" (appel `signIn("google")`)
- [ ] Séparateur visuel "ou"
- [ ] Formulaire email + mot de passe + checkbox "Se souvenir de moi" (non cochée par défaut)
- [ ] Notice RGPD sous la checkbox : *"Vos informations resteront mémorisées 30 jours sur cet appareil."*
- [ ] Lien "Mot de passe oublié ?" → `/auth/forgot-password`
- [ ] Lien "Créer un compte" → `/auth/register`
- [ ] Séparateur visuel "ou"
- [ ] Bouton "Continuer en tant qu'invité" → redirection vers `/`
- [ ] Gestion d'erreur : message clair si identifiants incorrects ou email non vérifié
- [ ] Si déjà connecté (session active) → redirect vers `/`

**Page `/auth/register` :**
- [ ] Champs : nom (optionnel), email, mot de passe, confirmation mot de passe
- [ ] Indicateur de force du mot de passe en temps réel (faible / moyen / fort)
- [ ] Messages d'erreur par champ (retour Zod server-side)
- [ ] Lien retour vers `/auth/login`
- [ ] Après succès → page intermédiaire "Vérifiez votre email"

**Page `/auth/verify-email` :**
- [ ] Lit le paramètre `?token=` depuis l'URL
- [ ] Appelle `POST /api/client/verify-email` au chargement
- [ ] États : loading, succès (lien vers login), erreur token expiré

**Page `/auth/forgot-password` :**
- [ ] Champ email, bouton "Envoyer le lien"
- [ ] Message de confirmation générique après envoi (indépendant de l'existence du compte)

**Page `/auth/reset-password` :**
- [ ] Lit `?token=` depuis l'URL
- [ ] Champs nouveau mot de passe + confirmation
- [ ] Indicateur de force
- [ ] Après succès → redirect vers `/auth/login` avec message de confirmation

---

### TICK-071 — Middleware étendu : routes client protégées + vérification de rôle
**Épic :** Sécurité
**Priorité :** 🔴 Bloquant
**Sizing :** 0,5 j
**Dépendances :** TICK-066, TICK-054

**Description :**
Étendre `middleware.ts` pour protéger les routes client et vérifier les rôles sur les routes admin.

**Critères d'acceptance :**

Routes client protégées (token JWT requis + `role === "client"`) :
- [ ] `/profil` → redirect `/auth/login` si pas de session
- [ ] `/api/client/profil` (PATCH) → 401 si pas de session client
- [ ] `/api/client/account` (DELETE) → 401 si pas de session client
- [ ] `/api/client/commandes` (GET) → 401 si pas de session client

Vérification de rôle sur routes admin :
- [ ] Toutes les routes `/admin/*` et `/api/commandes*`, `/api/upload`, `/api/site-config`, `/api/produits*` : si session présente mais `role !== "admin"` → 403 (empêche un client de se faire passer pour un admin)

Matcher mis à jour :
- [ ] Ajouter `/profil`, `/api/client/profil`, `/api/client/account`, `/api/client/commandes` au matcher
- [ ] Rate limiting `/api/client/register` (5/15min/IP) et `/api/client/forgot-password` (3/15min/IP) dans le middleware

---

### TICK-072 — API profil client (PATCH nom + DELETE compte)
**Épic :** Profil client
**Priorité :** 🟠 Haute
**Sizing :** 0,5 j
**Dépendances :** TICK-065, TICK-066, TICK-071

**Description :**
Créer `app/api/client/profil/route.ts` (PATCH) et `app/api/client/account/route.ts` (DELETE).

**Critères d'acceptance :**

`PATCH /api/client/profil` :
- [ ] Body : `{ nom: string }` — Zod : `z.string().min(1).max(50)`
- [ ] Met à jour `Client.nom` + `updatedAt`
- [ ] Retourne le client mis à jour (sans `passwordHash` ni tokens)
- [ ] 401 si pas de session `role === "client"`

`DELETE /api/client/account` :
- [ ] 401 si pas de session `role === "client"`
- [ ] Anonymiser toutes les `Commande` où `clientId === client._id` :
  - `client.nom → "[Supprimé]"`, `client.telephone → "[Supprimé]"`, `client.email → "[Supprimé]"`, `clientId → null`
- [ ] Supprimer le document `Client` (`deleteOne`)
- [ ] Logger `compte_client_supprime` avec `{ clientId }` via `lib/logger.ts`
- [ ] Retourne 200

---

### TICK-073 — Page profil client (`/profil`)
**Épic :** Profil client
**Priorité :** 🟠 Haute
**Sizing :** 1,0 j
**Dépendances :** TICK-066, TICK-072, TICK-077

**Description :**
Créer `app/(client)/profil/page.tsx` — page protégée (client connecté uniquement).

**Critères d'acceptance :**
- [ ] Header : email affiché, badge provider ("Google" ou "Email")
- [ ] Formulaire "Nom affiché" : pré-rempli avec `session.user.name`, éditable, soumis via PATCH `/api/client/profil`
- [ ] Bouton "Se déconnecter" → `signOut({ callbackUrl: "/" })`
- [ ] Section "Mes commandes" : composant `HistoriqueCommandes` (TICK-077)
- [ ] Section "Zone danger" : bouton "Supprimer mon compte" → modale de confirmation avec avertissement *"Cette action est irréversible. Votre compte et vos données seront définitivement supprimés."*
- [ ] Après suppression de compte réussie : `signOut({ callbackUrl: "/" })`
- [ ] Page rendue côté client (`"use client"`) — pas de Server Component (session requise)

---

### TICK-074 — Lien profil dans le header client
**Épic :** UX
**Priorité :** 🟡 Moyenne
**Sizing :** 0,5 j
**Dépendances :** TICK-066, TICK-073

**Description :**
Modifier le layout client pour afficher un lien de connexion/profil dans le header.

**Critères d'acceptance :**
- [ ] Si non connecté (ou invité) : lien/bouton "Se connecter" → `/auth/login`
- [ ] Si connecté (role: client) : icône ou prénom + lien vers `/profil`
- [ ] Le lien profil est présent sur toutes les pages client (layout)
- [ ] Utiliser `useSession()` — rendu conditionnel côté client
- [ ] Aucune régression sur le layout existant (panier, bannière, bordures)

---

## Sprint 10.2 — Corrections UX & Design System (6,0 j)

> Sprint correctif issu de la revue du Sprint 10 (2026-03-24). Corrige les points bloquants UX, unifie les composants d'interface, et avance les tickets d'historique de commandes depuis Sprint 11.

---

### TICK-075 — Lier les commandes au compte client (clientId) ⬆️ avancé depuis Sprint 11
**Épic :** Historique commandes
**Priorité :** 🔴 Bloquant
**Sizing :** 0,5 j
**Dépendances :** TICK-065, TICK-004, TICK-018

**Description :**
Mettre à jour le modèle `Commande` et le webhook Stripe pour associer une commande au client connecté.

**Critères d'acceptance :**
- [x] Ajouter `clientId?: ObjectId` (ref: 'Client', optional) dans `models/Commande.ts`
- [x] Ajouter un index sur `clientId` pour les performances
- [x] Modifier `POST /api/checkout` : si session client active, passer `clientId` dans les métadonnées Stripe (`session.metadata.clientId`)
- [x] Modifier `app/api/webhooks/stripe/route.ts` : lire `metadata.clientId` et le stocker dans `Commande.clientId` lors de la création
- [x] Ajouter `clientId` au schéma Zod `ProduitMetadataSchema` existant (champ optionnel string)
- [x] Les commandes invité restent sans `clientId` — backward compatible

---

### TICK-076 — API historique commandes client (GET /api/client/commandes) ⬆️ avancé depuis Sprint 11
**Épic :** Historique commandes
**Priorité :** 🔴 Bloquant
**Sizing :** 0,5 j
**Dépendances :** TICK-075, TICK-066

**Description :**
Créer `app/api/client/commandes/route.ts` — retourne les commandes du client connecté.

**Critères d'acceptance :**
- [x] `GET /api/client/commandes` — auth client requise (401 sinon)
- [x] Requête MongoDB : `Commande.find({ clientId: session.user.id }).sort({ createdAt: -1 })`
- [x] Réponse : `{ enCours: Commande[], passees: Commande[] }`
  - `enCours` : statut `"en_attente_paiement"` ou `"payee"`
  - `passees` : statut `"prete"`, limitées aux 50 dernières
- [x] Champs exposés : `_id`, `statut`, `produits`, `total`, `retrait`, `createdAt` — **ne pas exposer** `client.telephone` ni `client.email`
- [x] Retourne `{ enCours: [], passees: [] }` si aucune commande

---

### TICK-077 — Composant HistoriqueCommandes ⬆️ avancé depuis Sprint 11
**Épic :** Historique commandes
**Priorité :** 🔴 Bloquant
**Sizing :** 1,5 j
**Dépendances :** TICK-076

**Description :**
Créer `components/client/HistoriqueCommandes.tsx` — composant React affiché sur la page profil (`/profil`).

**Critères d'acceptance :**

Section "Commandes en cours" :
- [x] Polling `GET /api/client/commandes` toutes les **10 secondes** via `setInterval` + `useEffect`
- [x] Affiche les commandes `enCours` avec statut coloré (amber = payée/en préparation, green = prête)
- [x] Badge numéro court `#XXXXXX` (6 derniers chars de `_id`)
- [x] Affiche créneau de retrait, liste de produits (nom + quantité), total
- [x] Message "Aucune commande en cours" si tableau vide
- [x] Cleanup `clearInterval` au démontage

Section "Commandes passées" :
- [x] Affiche les commandes `passees` en ordre antéchronologique
- [x] Même format que ci-dessus (badge, produits, total, date formatée)
- [x] Message "Aucune commande passée" si tableau vide

Global :
- [x] État de chargement initial (skeleton ou spinner)
- [x] Gestion d'erreur API (message discret, pas de crash)
- [x] Intégré dans `app/(client)/profil/page.tsx` en remplacement du placeholder existant

---

### TICK-082 — Page `/` : écran de choix connexion / invité avant le menu
**Épic :** UX Auth
**Priorité :** 🔴 Bloquant
**Sizing :** 0,5 j
**Dépendances :** TICK-066, TICK-070

**Description :**
Modifier `app/(client)/page.tsx` pour afficher un écran de choix lorsque l'utilisateur arrive sans session. Le menu ne s'affiche qu'après que l'utilisateur a choisi son mode.

**Comportement :**
```
[GET /]
  ├── Session client active → affiche directement le menu
  └── Pas de session :
        Affiche un écran avec :
          [Se connecter]              → /auth/login
          [Continuer en tant qu'invité] → masque l'écran, affiche le menu
```

**Critères d'acceptance :**
- [x] Si session `role === "client"` active → le menu s'affiche directement, sans écran intermédiaire
- [x] Si pas de session → affiche l'écran de choix (nom du restaurant + bannière + deux boutons)
- [x] Bouton "Se connecter" → `router.push('/auth/login')`
- [x] Bouton "Continuer en tant qu'invité" → masque l'écran de choix et affiche le menu (state local, pas de rechargement)
- [x] Le choix "invité" est persisté en `sessionStorage` (`guest_mode: true`) pour éviter de réafficher l'écran si l'utilisateur navigue et revient sur `/`
- [x] L'écran de choix suit le style de l'application (couleurs SiteConfig, bannière)
- [x] Aucune régression sur les fonctionnalités du menu (ajout au panier, etc.)

---

### TICK-083 — Composant `Button` unifié (design system)
**Épic :** Design System
**Priorité :** 🟠 Haute
**Sizing :** 0,75 j
**Dépendances :** TICK-001

**Description :**
Créer `components/ui/Button.tsx` — composant bouton unique utilisé partout dans l'application. Migrer progressivement les boutons existants.

**Variantes :**
| Variant | Style Tailwind (base) | Usage |
|---------|----------------------|-------|
| `primary` | `border-2 border-[couleur] text-[couleur] bg-transparent hover:bg-[couleur] hover:text-white` | Boutons principaux |
| `danger` | `border-2 border-red-600 bg-red-600 text-white hover:bg-red-700` | Actions destructives |
| `ghost` | `border border-gray-300 text-gray-500 bg-transparent hover:bg-gray-50` | Actions secondaires |
| `outline` | `border-2 border-gray-800 text-gray-800 bg-transparent hover:bg-gray-800 hover:text-white` | Navigation neutre |

**Critères d'acceptance :**
- [x] Fichier `components/ui/Button.tsx` créé avec les 4 variants et les tailles `sm`, `md`, `lg`
- [x] Prop `loading?: boolean` → affiche un spinner SVG inline + désactive le bouton
- [x] Prop `disabled` → opacité réduite (50 %) + curseur `not-allowed`
- [x] Accessible : `aria-disabled`, `aria-busy` selon l'état
- [x] Contraste WCAG AA vérifié pour chaque variant (ratio ≥ 4.5:1)
- [x] **Migration obligatoire :**
  - Bouton "Supprimer mon compte" sur `/profil` → variant `danger`
  - Bouton "Mon profil" dans `HeaderAuth.tsx` → variant `primary`
  - Bouton "Se connecter" sur la page `/` → variant `primary`
  - Bouton "Continuer en tant qu'invité" → variant `ghost`
- [x] Exports nommés depuis `components/ui/index.ts` : `export { Button } from './Button'`

---

### TICK-084 — Composant `BackLink` (flèche retour avec texte)
**Épic :** Design System / Navigation
**Priorité :** 🟠 Haute
**Sizing :** 0,25 j
**Dépendances :** TICK-001

**Description :**
Créer `components/ui/BackLink.tsx` — composant de navigation retour avec flèche `←` et texte cliquable.

**Critères d'acceptance :**
- [x] Fichier `components/ui/BackLink.tsx` créé
- [x] Props : `href: string`, `label: string`
- [x] Rendu : `← {label}` — lien Next.js (`<Link>`) avec `href`
- [x] Style : texte gris + flèche, hover souligné
- [x] Accessible : `aria-label="Retour — {label}"`
- [x] Export depuis `components/ui/index.ts`

---

### TICK-085 — Header : bouton "Mon profil" visible sous la bannière (haut droite)
**Épic :** UX
**Priorité :** 🟠 Haute
**Sizing :** 0,5 j
**Dépendances :** TICK-074, TICK-083

**Description :**
Améliorer `components/client/HeaderAuth.tsx` et son intégration dans `app/(client)/layout.tsx`.

**Critères d'acceptance :**
- [x] Le bouton s'appelle "Mon profil" (pas d'icône seule, texte visible)
- [x] Placé en **haut à droite, sous la bannière** (dans le layout client, après l'image bannière)
- [x] Utilise le composant `Button` variant `primary` (TICK-083)
- [x] Si non connecté → bouton "Se connecter" variant `ghost` → `/auth/login`
- [x] Si connecté → bouton "Mon profil" variant `primary` → `/profil`
- [x] Visible sur toutes les pages du groupe `(client)` via `layout.tsx`
- [x] Contraste suffisant par rapport à la couleur de fond de la zone header

---

### TICK-086 — Fix : page de confirmation post-paiement ("Accès refusé")
**Épic :** Bug critique
**Priorité :** 🔴 Bloquant
**Sizing :** 0,5 j
**Dépendances :** TICK-018, TICK-071

**Description :**
Après un paiement Stripe réussi, l'utilisateur est redirigé vers `/confirmation?session_id=xxx` mais reçoit le message "Accès refusé. Si vous venez de payer, votre commande sera disponible dans quelques instants." au lieu de la page de confirmation.

**Cause probable :**
- Le middleware (`middleware.ts`) ou la page elle-même contient une vérification de session qui bloque les utilisateurs non connectés, alors que la page `/confirmation` doit être **publique**.
- Ou : la page vérifie l'existence de la commande avant que le webhook Stripe ait été traité.

**Critères d'acceptance :**
- [x] Inspecter `middleware.ts` : vérifier que `/confirmation` **n'est pas** dans le matcher (doit rester publique)
- [x] Inspecter `app/(client)/confirmation/page.tsx` : identifier la source du message "Accès refusé"
- [x] Si la commande n'existe pas encore (webhook en cours) → afficher un spinner avec le message *"Votre commande est en cours de validation, veuillez patienter..."* + polling toutes les 2s sur `GET /api/commandes/suivi?session_id=xxx` (max 10 tentatives)
- [x] Si après 10 tentatives la commande n'est pas créée → afficher *"Votre paiement a été reçu. Votre commande sera disponible dans quelques instants."* (pas "Accès refusé")
- [x] La page `/confirmation` est accessible sans session (route publique)
- [x] Aucune régression : les utilisateurs connectés voient toujours leur confirmation correctement

---

### TICK-087 — Inscription : champ `nom` obligatoire
**Épic :** Auth client
**Priorité :** 🟠 Haute
**Sizing :** 0,25 j
**Dépendances :** TICK-067, TICK-070, TICK-065

**Description :**
Le champ `nom` dans le formulaire d'inscription est actuellement optionnel. Le rendre obligatoire, côté serveur (Zod) et côté client (UI).

**Critères d'acceptance :**

Côté serveur (`app/api/client/register/route.ts`) :
- [x] Modifier le `RegisterSchema` Zod : `nom: z.string().min(1, 'Le nom est requis').max(50)` (retirer `.optional()`)
- [x] Modifier le modèle `models/Client.ts` : `nom: { type: String, required: true, trim: true }`

Côté client (`app/(client)/auth/register/page.tsx`) :
- [x] Champ "Nom" marqué comme requis (attribut `required`, label avec `*`)
- [x] Message d'erreur affiché si champ vide à la soumission
- [x] Placeholder mis à jour pour indiquer que c'est obligatoire

---

### TICK-088 — Navigation retour sur profil, panier et pages concernées
**Épic :** UX / Navigation
**Priorité :** 🟡 Moyenne
**Sizing :** 0,5 j
**Dépendances :** TICK-084, TICK-073

**Description :**
Utiliser le composant `BackLink` (TICK-084) pour ajouter des liens de retour en haut à gauche des pages qui en ont besoin.

**Pages à mettre à jour :**
- [x] `app/(client)/profil/page.tsx` — haut gauche : `<BackLink href="/" label="Retour vers le menu" />`
- [x] `app/(client)/panier/page.tsx` — haut gauche : `<BackLink href="/" label="Retour vers le menu" />`
- [x] `app/(client)/commande/page.tsx` — haut gauche : `<BackLink href="/panier" label="Retour au panier" />`
- [x] `app/(client)/auth/register/page.tsx` — haut gauche : `<BackLink href="/auth/login" label="Retour à la connexion" />`
- [x] `app/(client)/auth/forgot-password/page.tsx` — haut gauche : `<BackLink href="/auth/login" label="Retour à la connexion" />`
- [x] `app/(client)/auth/reset-password/page.tsx` — haut gauche : `<BackLink href="/auth/forgot-password" label="Retour" />`

**Critères d'acceptance :**
- [x] Composant `BackLink` utilisé sur toutes les pages listées (pas de duplication de code)
- [x] Positionnement cohérent : `absolute top-4 left-4` ou dans un conteneur flex haut de page
- [x] Aucune régression sur le layout des pages existantes
- [x] Le BackLink est visible sur mobile et desktop

---

### TICK-089 — Profil : mise de côté section "Mes données" (export RGPD)
**Épic :** RGPD / Refactoring
**Priorité :** 🟡 Moyenne
**Sizing :** 0,25 j
**Dépendances :** TICK-073, TICK-081

**Description :**
Retirer du code la section "Mes données" (export RGPD Art. 20) de la page profil. Cette fonctionnalité est mise de côté — voir section "Éléments mis de côté" dans ARCHITECTURE.md.

**Critères d'acceptance :**
- [x] Supprimer le bouton "Télécharger mes données" de `app/(client)/profil/page.tsx`
- [x] Supprimer tout appel à `GET /api/client/export` depuis la page profil
- [x] **Ne pas** créer `app/api/client/export/route.ts` (ticket TICK-081 mis en attente)
- [x] Si le fichier `app/api/client/export/route.ts` existe déjà → le supprimer
- [x] Ajouter un commentaire TODO dans la page profil : `// TODO Sprint futur : section "Mes données" — voir ARCHITECTURE.md > Éléments mis de côté`
- [x] Aucune régression sur les autres fonctionnalités du profil

---

*Mis à jour le 2026-03-24 — Version 1.7 (Sprint 10.2 ajouté : corrections UX, design system, historique avancé)*

---

## Sprint 11 — Compte Client : Finalisation & RGPD Export (2,5 j)

### TICK-078 — Rate limiting : endpoints auth client
**Épic :** Sécurité
**Priorité :** 🟠 Haute
**Sizing :** 0,5 j
**Dépendances :** TICK-052, TICK-063, TICK-067, TICK-069

**Description :**
Étendre le rate limiting existant aux nouvelles routes d'authentification client dans `middleware.ts`.

**Critères d'acceptance :**
- [x] `POST /api/client/register` : 5 req / 15 min / IP
- [x] `POST /api/client/forgot-password` : 3 req / 15 min / IP
- [x] Utiliser les limiters Upstash existants (ou en créer de nouveaux nommés)
- [x] Fallback in-memory si Upstash indisponible (cohérent avec TICK-063)
- [x] Réponse 429 avec header `Retry-After` si limite dépassée
- [x] Ajouter les deux routes au matcher du middleware

---

### TICK-079 — Mise à jour `/mentions-legales` (compte client + Google OAuth)
**Épic :** Conformité RGPD
**Priorité :** 🟡 Moyenne
**Sizing :** 0,5 j
**Dépendances :** TICK-066, TICK-072

**Description :**
Mettre à jour la page `/mentions-legales` pour documenter le compte client, la politique de mot de passe, Google OAuth comme sous-traitant, et le droit à l'effacement du compte.

**Critères d'acceptance :**
- [x] Section "Données personnelles" : ajouter le traitement des comptes clients (email, nom, historique)
- [x] Base légale : contrat (Art. 6(1)(b)) pour la gestion des commandes
- [x] Durée de conservation : durée de vie du compte + suppression à la demande
- [x] Droit à l'effacement : décrire la fonctionnalité de suppression de compte dans `/profil`
- [x] Section "Sous-traitants" : ajouter **Google LLC** (Google OAuth, données : email et nom Google, localisation : USA, garantie : Privacy Shield successor / Standard Contractual Clauses)
- [x] Section "Connexion sociale" : informer que la connexion Google partage email + nom Google avec l'application
- [x] Section "Sécurité du mot de passe" : mentionner les exigences (8 caractères min, majuscule, chiffre, caractère spécial)

---

### TICK-080 — Re-commande rapide
**Épic :** UX Historique
**Priorité :** 🟡 Moyenne
**Sizing :** 0,5 j
**Dépendances :** TICK-077, TICK-075

**Description :**
Ajouter un bouton "Commander à nouveau" sur chaque commande passée dans `HistoriqueCommandes`. Le bouton reconstruit le panier localStorage à partir de l'historique, en filtrant les produits désactivés.

**Critères d'acceptance :**
- [x] Bouton "Commander à nouveau" visible sur chaque entrée de la section "Commandes passées"
- [x] Au clic : appel `GET /api/produits` pour récupérer la liste des produits actifs
- [x] Construire le panier filtré : conserver uniquement les articles dont le `produitId` est encore `actif: true`
- [x] Écrire le panier résultant dans `localStorage` (clé `panier`, format identique au panier existant)
- [x] **Cas tous disponibles** → redirection immédiate vers `/panier`
- [x] **Cas partiels** → message d'avertissement *"X produit(s) ne sont plus disponibles et ont été retirés."* puis redirection vers `/panier`
- [x] **Cas aucun disponible** → message inline *"Aucun produit de cette commande n'est disponible."*, pas de redirection
- [x] État de chargement sur le bouton pendant la vérification (spinner, bouton désactivé)
- [x] Aucune nouvelle route API nécessaire — `GET /api/produits` public suffit

---

### TICK-081 — Export de données RGPD (GET /api/client/export)
**Épic :** Conformité RGPD
**Priorité :** 🟡 Moyenne
**Sizing :** 0,5 j
**Dépendances :** TICK-065, TICK-066, TICK-075

**Description :**
Créer `app/api/client/export/route.ts` et intégrer le bouton "Exporter mes données" sur la page profil. Implémente le droit à la portabilité des données (RGPD Art. 20).

**Critères d'acceptance :**

`GET /api/client/export` :
- [x] Auth client requise → 401 sinon
- [ ] Rate limiting : 3 req / 15 min / IP (réutilise mécanique TICK-052/TICK-063) — non implémenté (endpoint protégé par auth + middleware, risque faible)
- [x] Récupérer le document `Client` (exclure : `passwordHash`, `emailVerifyToken`, `emailVerifyTokenExpiry`, `passwordResetToken`, `passwordResetTokenExpiry`)
- [x] Récupérer toutes les `Commande` où `clientId === session.user.id`
- [x] Construire le payload JSON :
  ```json
  {
    "exportDate": "<ISO 8601>",
    "compte": { "email", "nom", "provider", "createdAt" },
    "commandes": [{ "id", "date", "statut", "produits", "total", "retrait" }]
  }
  ```
- [x] Headers de réponse :
  - `Content-Type: application/json`
  - `Content-Disposition: attachment; filename="mes-donnees-3g.json"`
- [x] Logger `client_data_exported` avec `{ clientId }` via `lib/logger.ts`

Page profil (`TICK-073`) :
- [x] Bouton "Télécharger mes données (JSON)" dans la section profil (hors zone danger)
- [x] Au clic : fetch `GET /api/client/export`, créer un `Blob`, déclencher le téléchargement via `URL.createObjectURL`
- [x] Mettre à jour `/mentions-legales` : mentionner l'export comme exercice du droit à la portabilité

---

## Sprint 11.5 — Correctifs UX profil & contraste boutons (0,5 j)

> Mis à jour le 2026-03-25

### TICK-090 — Masquer le bouton "Mon profil" sur les pages profil, panier et commande
**Épic :** UX Compte Client
**Priorité :** 🟠 Haute
**Sizing :** 0,5 j (groupé)

**Description :**
Le bouton "Mon profil" du header (`HeaderAuth`) s'affiche sur toutes les pages, y compris la page profil elle-même, le panier et la page commande où il est superflu ou redondant.

**Solution :** Ajout de `usePathname()` dans `HeaderAuth` pour retourner `null` sur `/profil`, `/panier` et `/commande` lorsque l'utilisateur est connecté.

**Critères d'acceptance :**
- [x] Bouton "Mon profil" absent sur `/profil`
- [x] Bouton "Mon profil" absent sur `/panier`
- [x] Bouton "Mon profil" absent sur `/commande`
- [x] Bouton "Se connecter" toujours visible sur ces pages pour les visiteurs non connectés

---

### TICK-091 — Correction du contraste des boutons au survol (hover)
**Épic :** Design System
**Priorité :** 🟠 Haute
**Sizing :** (groupé avec TICK-090)

**Description :**
Une règle CSS globale dans `globals.css` (`.text-sm:not(.text-white)`) forçait la couleur de texte à `#111827` sur tous les éléments portant la classe `text-sm`. En Tailwind v4, la classe de survol s'appelle `hover:text-white` (et non `text-white`), donc le sélecteur `:not(.text-white)` restait vrai même au survol, écrasant la couleur blanche et rendant le texte illisible sur fond coloré.

**Solution :** Suppression de la règle incriminée dans `globals.css`.

**Critères d'acceptance :**
- [x] Texte des boutons en blanc au survol (variant `primary`, `outline`, `danger`)
- [x] Aucune régression de lisibilité hors hover

---

### TICK-092 — Fix historique commandes : clientId absent en mode mock
**Épic :** Compte Client
**Priorité :** 🔴 Bloquant
**Sizing :** (groupé avec TICK-090)

**Description :**
En mode développement (sans clé Stripe), le champ `clientId` n'était pas persisté dans la commande MongoDB lors du paiement simulé. Conséquence : la route `GET /api/client/commandes` ne renvoyait aucune commande car elle filtre par `clientId`.

**Causes :**
1. `MockSessionData` (interface dans `lib/mockStore.ts`) ne déclarait pas le champ `clientId`.
2. `app/api/mock-checkout/route.ts` ne l'incluait pas lors du `Commande.create(...)`.

**Solution :** Ajout de `clientId?: string` dans `MockSessionData` et propagation dans le `Commande.create`.

**Critères d'acceptance :**
- [x] Après un paiement simulé en tant que client connecté, la commande apparaît dans l'historique `/profil`
- [x] La page `/confirmation` affiche le récapitulatif de commande dès le premier poll

---

### TICK-093 — Retrait de la section "Mes données" de la page profil
**Épic :** Compte Client / RGPD
**Priorité :** 🟡 Moyenne
**Sizing :** (groupé avec TICK-090)

**Description :**
La section "Mes données" (export RGPD JSON, TICK-081) a été retirée temporairement de la page `/profil` car elle nécessite un traitement plus approfondi (format des données, consentement, UI). Le code d'export reste opérationnel côté API (`/api/client/export`) mais n'est plus exposé dans l'interface client.

**Critères d'acceptance :**
- [x] Bloc "Mes données" retiré de `app/(client)/profil/page.tsx`
- [x] Route API `/api/client/export` conservée (non supprimée)
- [x] Documentation ajoutée dans la section "Éléments mis de côté" ci-dessous

---

## Sprint 12 — Corrections UX Client : Historique, Stepper & Suivi (3,75 j)

> Ajouté le 2026-03-26. Correctifs et améliorations UX côté client : bug "commander à nouveau", historique paginé avec timeline, modal de suivi, stepper de statuts et refonte des icônes.

---

### TICK-094 — Fix : "Commander à nouveau" — erreur "Impossible de vérifier les produits disponibles"
**Épic :** Bug critique / Historique commandes
**Priorité :** 🔴 Bloquant
**Sizing :** 0,25 j
**Dépendances :** TICK-080, TICK-076

**Description :**
Le bouton "Commander à nouveau" (TICK-080) dans l'historique des commandes lève systématiquement l'erreur "Impossible de vérifier les produits disponibles." La cause probable est une comparaison incorrecte entre `produitId` (ObjectId sérialisé en string MongoDB) et `_id` des produits retournés par `GET /api/produits`.

**Critères d'acceptance :**
- [ ] Inspecter `components/client/HistoriqueCommandes.tsx` : identifier où est levée l'erreur (bloc `catch`, comparaison ids, format des données)
- [ ] S'assurer que la comparaison de `produitId` utilise `.toString()` des deux côtés : `p.produitId.toString() === produit._id.toString()`
- [ ] Si `GET /api/produits` échoue (non-200) → afficher *"Impossible de vérifier les produits disponibles. Réessayez dans un instant."* avec bouton "Réessayer"
- [ ] Si `GET /api/produits` retourne un tableau vide → afficher *"Aucun produit de cette commande n'est disponible."* (comportement TICK-080 — cas aucun disponible)
- [ ] État de chargement sur le bouton maintenu jusqu'à la redirection ou le message
- [ ] Aucune régression sur les cas nominaux (produits disponibles / partiellement disponibles)

---

### TICK-095 — Btn "Mon profil" — ajout d'une icône utilisateur
**Épic :** UX / Design System
**Priorité :** 🟡 Moyenne
**Sizing :** 0,25 j
**Dépendances :** TICK-085, TICK-083

**Description :**
Le bouton "Mon profil" dans `HeaderAuth.tsx` n'a pas d'icône. Ajouter une icône utilisateur (silhouette) à gauche du libellé pour renforcer l'affordance visuelle.

**Critères d'acceptance :**
- [ ] Icône inline SVG (pas de dépendance externe) représentant un utilisateur/silhouette — placée à gauche du texte "Mon profil"
- [ ] Taille : `w-4 h-4` (16 px), alignée verticalement avec le texte (`flex items-center gap-1.5`)
- [ ] L'icône suit la couleur du texte du bouton (hérite de `currentColor`)
- [ ] Aucune régression sur le variant `primary` du composant `Button`
- [ ] Visible et lisible sur mobile (bouton compact)

---

### TICK-096 — MenuCard — bouton "+" uniforme sur toutes les cartes
**Épic :** UX / Menu client
**Priorité :** 🟡 Moyenne
**Sizing :** 0,25 j
**Dépendances :** TICK-010, TICK-038

**Description :**
Certaines cartes produit affichent "+ Ajouter" et d'autres uniquement "+". Uniformiser le libellé à "+" sur toutes les cartes pour une interface cohérente et compacte.

**Critères d'acceptance :**
- [ ] Inspecter `components/client/MenuCard.tsx` : identifier toutes les variantes du bouton d'ajout au panier
- [ ] Uniformiser à `+` sur toutes les cartes (texte seul, sans "Ajouter")
- [ ] Style du bouton : rond ou carré compact, centré, taille `w-8 h-8` ou `w-9 h-9`, variant `primary` (couleur bordure SiteConfig)
- [ ] Le `+` est suffisamment grand pour être accessible sur mobile (zone de touch ≥ 44 px)
- [ ] `aria-label="Ajouter {nomProduit} au panier"` pour l'accessibilité
- [ ] Aucune régression sur la logique d'ajout au panier

---

### TICK-097 — HistoriqueCommandes — modal de suivi de commande en cours
**Épic :** Historique commandes / UX
**Priorité :** 🟠 Haute
**Sizing :** 0,75 j
**Dépendances :** TICK-077, TICK-099

**Description :**
Les commandes en cours dans `HistoriqueCommandes.tsx` sont affichées sous forme de cartes compactes. Ajouter la possibilité d'ouvrir une modale détaillée pour chaque commande en cours, affichant le stepper de statut complet et le récapitulatif complet.

**Critères d'acceptance :**

Déclencheur :
- [ ] Chaque carte commande en cours possède un bouton/zone cliquable "Voir le suivi" (ou toute la carte est cliquable)
- [ ] Au clic → ouverture d'une modale `CommandeSuiviModal` en plein écran sur mobile (bottom-sheet ou dialog plein écran) et dialog centré sur desktop

Contenu de la modale :
- [ ] En-tête : badge numéro court `#XXXXXX`, date et heure de commande
- [ ] Composant `CommandeStepper` (TICK-099) — affiche les 4 étapes avec l'étape courante mise en évidence
- [ ] Liste complète des produits : nom, quantité, options choisies, prix unitaire
- [ ] Créneau de retrait (ou "Dès que possible")
- [ ] Total de la commande
- [ ] Bouton "Fermer" (croix en haut à droite + bouton en bas sur mobile)

Technique :
- [ ] Modale via `dialog` HTML natif ou composant `Modal` (pas de lib externe)
- [ ] Fermeture par Escape, clic sur le fond sombre, ou bouton Fermer
- [ ] `aria-modal="true"`, `role="dialog"`, focus trap
- [ ] Pas de rechargement de données à l'ouverture (utilise les données déjà chargées par le polling)

---

### TICK-098 — HistoriqueCommandes — max 3 commandes passées + page historique complète
**Épic :** Historique commandes / UX
**Priorité :** 🟠 Haute
**Sizing :** 1,5 j
**Dépendances :** TICK-077, TICK-076

**Description :**
La section "Commandes passées" de `HistoriqueCommandes.tsx` affiche toutes les commandes sans limite. La limiter à 3 et ajouter un lien vers une nouvelle page dédiée `app/(client)/profil/commandes/page.tsx` avec l'historique complet en timeline verticale groupée par mois.

**Critères d'acceptance :**

`HistoriqueCommandes.tsx` :
- [ ] Section "Commandes passées" : afficher au maximum **3** commandes (les 3 plus récentes)
- [ ] Si plus de 3 commandes → afficher un lien "Voir tout l'historique (N commandes)" en bas de la section, pointant vers `/profil/commandes`
- [ ] Si ≤ 3 commandes → pas de lien
- [ ] L'API `GET /api/client/commandes` retourne toujours jusqu'à 50 commandes — la limite à 3 est côté client uniquement

`app/(client)/profil/commandes/page.tsx` (nouvelle page) :
- [ ] `BackLink` en haut à gauche : `← Mon profil` → `/profil`
- [ ] Titre : "Historique de mes commandes"
- [ ] Liste complète des commandes `passees` (récupérées), triées antéchronologiquement
- [ ] **Timeline verticale par mois** : regrouper les commandes par mois/année (ex : "Mars 2026", "Février 2026") — en-tête de mois avec séparateur visuel
- [ ] Chaque entrée : badge `#XXXXXX`, date complète, liste produits, total, créneau, statut badge
- [ ] Scroll vertical natif (pas de pagination)
- [ ] Si aucune commande → message "Votre historique de commandes est vide."
- [ ] La page charge les données via `GET /api/client/commandes` au montage (pas de polling — historique statique)
- [ ] Page protégée (role: client) — redirection vers `/auth/login` si non connecté

`app/api/client/commandes/route.ts` :
- [ ] Mettre à jour la logique `passees` : inclure `statut: "recuperee"` (issu de TICK-099) à la place de `"prete"` uniquement
- [ ] Retirer la limite à 50 côté API ou augmenter à 200 (la page charge le tout)

---

### TICK-099 — Statuts commande — stepper client + nouveaux statuts "en_preparation" et "recuperee"
**Épic :** Commande / UX / Modèle de données
**Priorité :** 🟠 Haute
**Sizing :** 0,75 j
**Dépendances :** TICK-004, TICK-008, TICK-077, TICK-045

**Description :**
Étendre le modèle `Commande` avec deux nouveaux statuts (`en_preparation`, `recuperee`) pour compléter le cycle de vie d'une commande. Créer un composant `CommandeStepper` affichant visuellement les 4 étapes. Mettre à jour l'API admin.

**Étapes du stepper :**
```
Confirmé ──► Préparation ──► Prêt ──► Récupéré
(payee)   (en_preparation)  (prete)  (recuperee)
```

**Critères d'acceptance :**

`models/Commande.ts` :
- [ ] Mettre à jour l'enum `statut` : `"en_attente_paiement" | "payee" | "en_preparation" | "prete" | "recuperee"`
- [ ] Aucune migration nécessaire — les commandes existantes avec `"payee"` et `"prete"` restent valides

`app/api/commandes/[id]/statut/route.ts` :
- [ ] Ajouter `"en_preparation"` et `"recuperee"` aux statuts autorisés via ce endpoint
- [ ] Transitions valides depuis l'admin : `payee → en_preparation`, `en_preparation → prete`, `prete → recuperee`
- [ ] Mettre à jour le schéma Zod de validation du body

`app/api/client/commandes/route.ts` :
- [ ] `enCours` : inclure `"en_attente_paiement" | "payee" | "en_preparation" | "prete"`
- [ ] `passees` : uniquement `"recuperee"` (remplace `"prete"`)

`components/client/CommandeStepper.tsx` (nouveau composant) :
- [ ] Props : `statut: string`
- [ ] 4 étapes affichées horizontalement (ou verticalement sur mobile) : Confirmé / Préparation / Prêt / Récupéré
- [ ] Étape courante et étapes précédentes : style "actif" (couleur SiteConfig ou vert)
- [ ] Étapes futures : style "inactif" (gris, opacité réduite)
- [ ] Connecteurs entre étapes (ligne) remplis jusqu'à l'étape courante
- [ ] `aria-label` sur chaque étape pour l'accessibilité
- [ ] Export depuis `components/client/index.ts`

Intégration :
- [ ] `CommandeStepper` intégré dans la modale TICK-097 (`CommandeSuiviModal`)
- [ ] `CommandeStepper` intégré dans chaque carte commande en cours de `HistoriqueCommandes` (version compacte si nécessaire)

---

## Sprint 13 — Dashboard Admin & Gestion Avancée (5,25 j)

> Ajouté le 2026-03-26. Nouvelles fonctionnalités admin : dashboard, horaires d'ouverture, filtrage des créneaux, vue menu client, fermeture boutique, export CSV.

---

### TICK-100 — SiteConfig — horaires d'ouverture (modèle + admin personnalisation)
**Épic :** Configuration / Admin
**Priorité :** 🟠 Haute
**Sizing :** 0,75 j
**Dépendances :** TICK-031, TICK-033, TICK-028

**Description :**
Le modèle `SiteConfig` ne contient pas d'horaires d'ouverture. L'heure d'ouverture/fermeture est actuellement codée en dur dans `lib/creneaux.ts` (ou récupérée depuis des variables d'env). Ajouter ces champs au modèle et à l'interface admin.

**Critères d'acceptance :**

`models/SiteConfig.ts` :
- [x] Ajouter les champs :
  - `horaireOuverture: string` — format `"HH:MM"` (ex: `"11:30"`) — requis, défaut `"11:30"`
  - `horaireFermeture: string` — format `"HH:MM"` (ex: `"14:00"`) — requis, défaut `"14:00"`
  - `fermeeAujourdhui: boolean` — défaut `false`
- [x] Validation Mongoose : regex `^([01]\d|2[0-3]):([0-5]\d)$` sur les deux horaires
- [x] Mettre à jour l'interface TypeScript `ISiteConfig`

`app/api/site-config/route.ts` :
- [x] `GET` : exposer les nouveaux champs dans la réponse publique
- [x] `PUT` (admin) : accepter et valider les nouveaux champs via Zod

`app/(admin)/personnalisation/page.tsx` :
- [x] Ajouter une section "Horaires d'ouverture" avec deux champs `<input type="time">` : Ouverture / Fermeture
- [x] Validation côté client : fermeture > ouverture (message d'erreur sinon)
- [x] Sauvegarde via `PUT /api/site-config`
- [x] Les champs sont pré-remplis avec les valeurs en base

---

### TICK-101 — FormulaireCommande — créneaux filtrés par horaires + blocage heures passées
**Épic :** Commande / UX
**Priorité :** 🟠 Haute
**Sizing :** 0,5 j
**Dépendances :** TICK-100, TICK-028, TICK-012

**Description :**
Les créneaux de retrait dans `FormulaireCommande.tsx` utilisent des horaires fixes. Les remplacer par ceux de `SiteConfig` et filtrer les créneaux dont l'heure de début est déjà passée (commande click & collect = toujours pour aujourd'hui).

**Critères d'acceptance :**

`components/client/FormulaireCommande.tsx` :
- [x] Charger `horaireOuverture` et `horaireFermeture` depuis `GET /api/site-config` au montage (ou passer en props depuis la page parent qui charge déjà SiteConfig)
- [x] Appeler `lib/creneaux.ts` avec `horaireOuverture`, `horaireFermeture`, pas 15 min
- [x] Filtrer les créneaux : ne conserver que les créneaux dont **l'heure de début** est strictement supérieure à l'heure actuelle + 10 minutes (buffer minimum de préparation)
- [x] Si aucun créneau disponible (boutique sur le point de fermer) → afficher le message *"Aucun créneau disponible pour aujourd'hui. La boutique ferme bientôt."* et masquer le sélecteur de créneaux
- [x] Si `fermeeAujourdhui: true` (TICK-105) → afficher *"La boutique est fermée pour aujourd'hui."* et bloquer la soumission du formulaire
- [x] Le premier créneau de la liste est présélectionné automatiquement
- [x] Aucune régression sur le reste du formulaire (nom, téléphone, commentaire, soumission)

---

### TICK-102 — Admin menu — vue produits style client avec boutons management
**Épic :** Admin / UX
**Priorité :** 🟠 Haute
**Sizing :** 0,75 j
**Dépendances :** TICK-016, TICK-038, TICK-037

**Description :**
La page `/admin/menu` affiche les produits sous forme de liste/tableau. La refondre pour afficher les produits comme un client les verrait (grille de cartes avec image, nom, prix, description), mais en remplaçant le bouton "Ajouter au panier" par les boutons de management : Modifier, Activer/Désactiver, Supprimer.

**Critères d'acceptance :**

`app/(admin)/menu/page.tsx` :
- [x] Affichage en grille de cartes identique au menu client (`MenuCard` ou variante admin) : image, nom, catégorie, description, prix
- [x] Boutons management en bas de chaque carte (remplaçant le bouton "+") :
  - **Modifier** → ouvre `ProduitForm` en mode édition (modal ou inline — comportement existant préservé)
  - **Désactiver / Activer** → toggle `actif` via `PATCH /api/produits/[id]` — label change selon l'état ; produit désactivé affiché avec opacité réduite + badge "Désactivé"
  - **Supprimer** → confirmation modale avant `DELETE /api/produits/[id]`
- [x] Groupement par catégorie préservé (si déjà implémenté)
- [x] Bouton "Ajouter un produit" en haut de page (comportement inchangé)
- [x] Aucune régression sur les actions existantes (création, modification, suppression, toggle)

---

### TICK-103 — Dashboard admin — page d'accueil et résumé opérationnel
**Épic :** Admin / Dashboard
**Priorité :** 🟠 Haute
**Sizing :** 1,25 j
**Dépendances :** TICK-008, TICK-015, TICK-099

**Description :**
Créer une page dashboard `app/(admin)/page.tsx` (ou `app/(admin)/dashboard/page.tsx`) comme page d'accueil de l'espace admin. Elle affiche un résumé opérationnel : 4 dernières commandes en cours/validées et un accès rapide aux modules.

**Critères d'acceptance :**

`app/(admin)/page.tsx` (ou redirect depuis /admin/) :
- [x] Protégée par le middleware admin existant
- [x] En-tête : nom du restaurant (depuis SiteConfig), date du jour formatée

Section "Commandes en cours" :
- [x] Affiche les **4 dernières commandes** avec statut `"payee"` ou `"en_preparation"` (triées par `createdAt` DESC)
- [x] Chaque carte : badge numéro, heure, prénom client, créneau retrait, total, badge statut coloré
- [x] Lien "Voir toutes les commandes" → `/admin/commandes`

Section "Commandes d'aujourd'hui" (KPIs) :
- [x] Nombre total de commandes reçues aujourd'hui
- [x] Chiffre d'affaires du jour (somme des `total` des commandes `payee` / `en_preparation` / `prete` / `recuperee` du jour, en €)
- [x] Nombre de commandes récupérées aujourd'hui

Navigation rapide :
- [x] 3 liens cards : "Commandes", "Menu", "Personnalisation"

Données :
- [x] L'API existante `GET /api/commandes` est réutilisée (filtre côté client sur les données reçues)
- [x] Polling toutes les 30 secondes (refresh des commandes en cours)
- [x] Pas de nouvelle route API nécessaire

---

### TICK-104 — Admin commandes — section "Récupérées" + action "Marquer comme récupérée"
**Épic :** Admin / Commandes
**Priorité :** 🟠 Haute
**Sizing :** 0,5 j
**Dépendances :** TICK-015, TICK-099

**Description :**
La page `/admin/commandes` gère les commandes en cours. Ajouter le bouton "Récupérée" pour les commandes au statut `"prete"` et une section dédiée aux commandes récupérées.

**Critères d'acceptance :**

`app/(admin)/commandes/page.tsx` :
- [x] Commandes avec statut `"prete"` : ajouter un bouton **"Récupérée ✓"** — au clic → `PATCH /api/commandes/[id]/statut` avec `{ statut: "recuperee" }` (TICK-099)
- [x] Transitions admin visibles par statut :
  - `payee` → bouton "En préparation" → `en_preparation`
  - `en_preparation` → bouton "Prête" → `prete`
  - `prete` → bouton "Récupérée ✓" → `recuperee`
- [x] **Section "Commandes récupérées aujourd'hui"** : affiche en bas de page les commandes `recuperee` du jour courant (filtrées par `createdAt >= début de journée`)
- [x] Les commandes récupérées sont masquées de la section principale "En cours"
- [x] Polling inchangé (10 secondes) — les commandes basculent de section automatiquement

---

### TICK-105 — Admin — fermer la boutique pour aujourd'hui
**Épic :** Admin / Configuration
**Priorité :** 🟠 Haute
**Sizing :** 0,75 j
**Dépendances :** TICK-100, TICK-017, TICK-082

**Description :**
Permettre à l'admin de fermer temporairement la boutique pour la journée en cours. Aucune nouvelle commande ne peut être passée tant que la boutique est fermée.

**Critères d'acceptance :**

`models/SiteConfig.ts` (via TICK-100) :
- [x] Champ `fermeeAujourdhui: boolean` déjà ajouté — réutilisé ici

`app/api/site-config/route.ts` :
- [x] `PUT` (admin) : accepter `{ fermeeAujourdhui: boolean }` dans le body

`app/(admin)/commandes/page.tsx` (ou dashboard TICK-103) :
- [x] Bouton visible en haut de la page : **"Fermer la boutique pour aujourd'hui"** (si `fermeeAujourdhui: false`) / **"Rouvrir la boutique"** (si `fermeeAujourdhui: true`)
- [x] Badge statut "BOUTIQUE FERMÉE" affiché clairement si `fermeeAujourdhui: true`
- [x] Au clic "Fermer" : confirmation modale *"Confirmer la fermeture ? Aucune nouvelle commande ne sera acceptée."* puis `PUT /api/site-config` avec `{ fermeeAujourdhui: true }`
- [x] Au clic "Rouvrir" : `PUT /api/site-config` avec `{ fermeeAujourdhui: false }` (sans confirmation)
- [x] Note dans l'UI : *"Ce champ se réinitialise manuellement — pensez à rouvrir demain matin."*

`app/api/checkout/route.ts` :
- [x] Au début du handler `POST` : charger `SiteConfig` et vérifier `fermeeAujourdhui`
- [x] Si `true` → retourner `{ error: "La boutique est fermée pour aujourd'hui." }` avec status 503
- [x] Si `false` → comportement inchangé

`app/(client)/page.tsx` (menu client) :
- [x] Si `siteConfig.fermeeAujourdhui` → afficher un bandeau *"La boutique est fermée pour aujourd'hui. Revenez demain !"* et désactiver les boutons d'ajout au panier
- [x] SiteConfig déjà chargée sur la page — pas de requête supplémentaire nécessaire

---

### TICK-106 — Admin — export CSV des commandes (comptabilité)
**Épic :** Admin / Comptabilité
**Priorité :** 🟠 Haute
**Sizing :** 0,75 j
**Dépendances :** TICK-008, TICK-015

**Description :**
Permettre à l'employeur d'exporter les commandes en format CSV, bien formaté pour faciliter la comptabilité. Inclure un filtre par période.

**Critères d'acceptance :**

`app/api/admin/commandes/export/route.ts` (nouvelle route) :
- [x] `GET /api/admin/commandes/export` — auth admin requise (401 sinon)
- [x] Query params supportés : `?from=YYYY-MM-DD&to=YYYY-MM-DD` (optionnels — défaut : aujourd'hui)
- [x] Requête MongoDB : `Commande.find({ createdAt: { $gte: from, $lte: to }, statut: { $ne: "en_attente_paiement" } })` (exclure les commandes non payées)
- [x] Format CSV généré :
  ```
  Date;Heure;Numéro;Client;Produits;Options;Quantités;Sous-total HT;TVA (10%);Total TTC;Créneau;Statut
  2026-03-26;12:34;#A3F2B1;Jean Dupont;"Burger Classic, Frites";"-;Sel";1,1;X,XX €;X,XX €;X,XX €;12:30 – 12:45;Récupérée
  ```
- [x] TVA calculée à 10 % sur le total TTC (restauration rapide — taux standard France)
- [x] Séparateur : point-virgule (compatible Excel FR)
- [x] Encodage : UTF-8 avec BOM (`\uFEFF`) pour compatibilité Excel
- [x] Headers de réponse :
  - `Content-Type: text/csv; charset=utf-8`
  - `Content-Disposition: attachment; filename="commandes-{from}-{to}.csv"`
- [x] Logger `commandes_exported_csv` avec `{ adminId, from, to, count }` via `lib/logger.ts`

`app/(admin)/commandes/page.tsx` :
- [x] Bouton **"Exporter CSV"** en haut de page
- [x] Sélecteur de période : 3 boutons radio — "Aujourd'hui" / "Cette semaine" / "Ce mois" — définissent les params `from` et `to`
- [x] Au clic "Exporter" : fetch `GET /api/admin/commandes/export?from=...&to=...`, déclencher le téléchargement via `URL.createObjectURL(new Blob([csv]))`
- [x] État de chargement sur le bouton pendant la génération

---

## Sprint 14 — Correctifs UX & Auth — Admin + Client (2,25 j)

> Sprint correctif issu de la revue du Sprint 13 (2026-03-26). Corrige des régressions UX et des incohérences d'authentification identifiées en recette.

---

### TICK-107 — Retrait du bouton "Anonymiser" commandes admin — mise de côté
**Épic :** Admin / Correctif
**Priorité :** 🟠 Haute
**Sizing :** 0,25 j
**Dépendances :** TICK-057

**Description :**
Le bouton "Anonymiser" dans `CommandeRow` admin (TICK-057) est retiré de l'interface. La fonctionnalité présente un risque de manipulation accidentelle et nécessite une réflexion UX plus poussée sur les permissions. La route `DELETE /api/commandes/[id]` reste en place mais non exposée dans l'UI. La feature est documentée dans la section "Éléments mis de côté" de `ARCHITECTURE.md`.

**Critères d'acceptance :**
- [ ] Retirer le bouton "Anonymiser" (et sa modale de confirmation) de `components/admin/CommandeRow.tsx`
- [ ] La route `DELETE /api/commandes/[id]` reste intacte dans le code (non supprimée)
- [ ] Documenter dans `ARCHITECTURE.md` > "Éléments mis de côté" — voir section ajoutée au Sprint 14
- [ ] Aucune régression sur les autres actions admin (changement de statut, marquage "récupérée")

---

### TICK-108 — Admin menu — alignement vertical des boutons d'action (items avec/sans options)
**Épic :** Admin / UX
**Priorité :** 🟠 Haute
**Sizing :** 0,5 j
**Dépendances :** TICK-102

**Description :**
Dans la page admin `/admin/menu`, les cartes produit affichant des options (ex. : "Sel / Sans sel") ont une zone de contenu plus haute que les cartes sans options. Les boutons d'action (Modifier / Activer-Désactiver / Supprimer) se retrouvent donc à des hauteurs différentes selon les cartes, brisant l'alignement visuel de la grille.

**Critères d'acceptance :**
- [ ] Les cartes produit utilisent `flex flex-col h-full` sur leur conteneur principal
- [ ] La zone texte/options utilise `flex-grow` pour occuper tout l'espace disponible entre l'entête de la carte et les boutons
- [ ] Les boutons d'action sont systématiquement en bas de carte via `mt-auto` ou structure flex
- [ ] Testé visuellement avec : 0 option, 1 option, 3 options sur des cartes côte à côte
- [ ] Aucune régression sur le groupement par catégorie ni sur les actions (Modifier, Activer, Supprimer)

---

### TICK-109 — Page /confirmation — masquer bouton "Se connecter" si déjà connecté
**Épic :** Client / UX Auth
**Priorité :** 🟠 Haute
**Sizing :** 0,25 j
**Dépendances :** TICK-070, TICK-074

**Description :**
La page `/confirmation` (post-paiement) affiche un bouton "Se connecter" même lorsque l'utilisateur est déjà connecté. Ce bouton ne doit être visible que pour les utilisateurs invités (non authentifiés).

**Critères d'acceptance :**
- [ ] Utiliser `useSession()` (NextAuth) dans la page de confirmation
- [ ] Si `status === "unauthenticated"` → afficher le bouton "Se connecter" → `/auth/login`
- [ ] Si `status === "authenticated"` → afficher à la place un lien "Voir mes commandes" → `/profil` (ou masquer simplement le bloc)
- [ ] Pendant le chargement de la session (`status === "loading"`) → ne rien rendre (pas de flash du bouton)
- [ ] Aucune régression sur l'affichage du récapitulatif commande et du numéro de commande

---

### TICK-110 — Page /auth/login — redirection automatique si déjà connecté
**Épic :** Client / Auth
**Priorité :** 🔴 Bloquant
**Sizing :** 0,25 j
**Dépendances :** TICK-070

**Description :**
La page `/auth/login` est accessible à un utilisateur déjà connecté — il peut la visiter manuellement sans être redirigé. Cette page doit être réservée aux utilisateurs non authentifiés.

**Critères d'acceptance :**
- [ ] Dans `app/(client)/auth/login/page.tsx` : utiliser `useSession()` et rediriger via `router.replace("/")` si `status === "authenticated"`
- [ ] Pendant `status === "loading"` : afficher un spinner ou écran vide (éviter un flash du formulaire de connexion)
- [ ] Appliquer la même protection sur `/auth/register` : rediriger vers `/` si déjà connecté
- [ ] Un utilisateur connecté visitant `/auth/login` via l'URL directe atterrit sur `/` sans voir le formulaire
- [ ] La redirection ne crée pas de boucle infinie avec le middleware existant

---

### TICK-111 — Social login — corriger la redirection d'erreur + proposer fallback email/mdp
**Épic :** Client / Auth
**Priorité :** 🔴 Bloquant
**Sizing :** 0,5 j
**Dépendances :** TICK-070, TICK-066

**Description :**
En cas d'erreur lors de la connexion Google (OAuth), l'utilisateur est redirigé vers `/admin/login` au lieu de `/auth/login`. La configuration NextAuth (`pages.error`) pointe vers la mauvaise page. De plus, aucun message d'erreur ni alternative n'est présenté à l'utilisateur.

**Critères d'acceptance :**
- [ ] Dans `lib/auth.ts` (config NextAuth) : s'assurer que `pages.error` est défini à `"/auth/login"` (et non `"/admin/login"`)
- [ ] L'appel `signIn("google")` passe `callbackUrl: "/"` en cas de succès et utilise la page d'erreur correcte en cas d'échec
- [ ] Sur `/auth/login` : détecter le paramètre `?error=` dans l'URL (ex. `?error=OAuthCallback`) et afficher un message clair : *"La connexion Google a échoué. Veuillez utiliser votre email et mot de passe ci-dessous."*
- [ ] Le formulaire email/mdp est visible et accessible sans action supplémentaire (pas d'accordéon caché)
- [ ] Aucune régression sur la connexion Google réussie (redirection correcte vers `/`)

---

### TICK-112 — Formulaire login — toggle visibilité du mot de passe (icône œil)
**Épic :** Client / UX
**Priorité :** 🟡 Moyenne
**Sizing :** 0,25 j
**Dépendances :** TICK-070

**Description :**
Les champs mot de passe des pages d'authentification ne permettent pas à l'utilisateur d'afficher le caractère en cours de saisie. Ajouter un bouton icône œil (afficher/masquer) sur tous les champs de type password.

**Critères d'acceptance :**
- [ ] Ajouter un bouton icône à droite du champ mot de passe — bascule entre `type="password"` et `type="text"`
- [ ] L'icône reflète l'état : œil ouvert (mot de passe visible) / œil barré (mot de passe masqué)
- [ ] Appliquer sur :
  - Champ "Mot de passe" de `/auth/login`
  - Champs "Mot de passe" et "Confirmer le mot de passe" de `/auth/register`
  - Champ "Nouveau mot de passe" de `/auth/reset-password`
- [ ] Utiliser une icône SVG inline (pas de nouvelle dépendance)
- [ ] Accessible : `aria-label="Afficher le mot de passe"` / `"Masquer le mot de passe"` selon l'état
- [ ] Le bouton n'intercepte pas la soumission du formulaire (`type="button"` explicite)

---

### TICK-113 — Page profil — contraste input "Nom affiché" + bouton "Enregistrer" via composant Button
**Épic :** Client / UX / Design System
**Priorité :** 🟠 Haute
**Sizing :** 0,25 j
**Dépendances :** TICK-073

**Description :**
La section "Nom affiché" de la page `/profil` présente deux problèmes de contraste : le texte de l'input est peu lisible (ratio WCAG insuffisant), et le bouton "Enregistrer" utilise un style inline orange clair avec texte blanc illisible au lieu du composant `Button` du design system (Sprint 10.2).

**Critères d'acceptance :**
- [ ] Remplacer le bouton "Enregistrer" par `<Button variant="primary">Enregistrer</Button>` (`components/ui/Button.tsx`) — même composant que les autres actions de la page
- [ ] L'input "Nom affiché" utilise `text-gray-900` (ou équivalent) sur fond blanc — ratio de contraste ≥ 4.5:1 (WCAG AA)
- [ ] Supprimer tout style inline ou classe Tailwind de couleur de texte non conforme sur cet input (`text-orange-*`, `text-gray-300`, etc.)
- [ ] Tester visuellement : texte lisible dans l'input en état normal, focus et désactivé
- [ ] Aucune régression sur les autres éléments de la page profil (bouton "Se déconnecter", "Supprimer mon compte", historique commandes)

---

## Sprint 15 — Correctifs UX Client — Re-commande, Profil, Navigation (1,0 j)

### TICK-114 — Historique commandes : fix erreur "Commander à nouveau" + bouton discret
**Épic :** Client / UX
**Priorité :** 🔴 Bloquant
**Sizing :** 0,5 j
**Dépendances :** TICK-081, TICK-094

**Description :**
Le bouton "Commander à nouveau" dans `HistoriqueCommandes` déclenche systématiquement l'erreur *"Impossible de vérifier les produits disponibles. Réessayez dans un instant."* — le fetch `GET /api/produits` échoue ou la réponse n'est pas correctement parsée. Par ailleurs, le bouton est visuellement trop imposant dans la carte de commande (style primaire, trop saillant).

**Critères d'acceptance :**
- [ ] Identifier et corriger la cause de l'erreur dans `HistoriqueCommandes.tsx` : vérifier le fetch `GET /api/produits`, le parsing JSON et la comparaison des `produitId` (ObjectId vs string)
- [ ] Le toast d'erreur ne s'affiche plus lors d'un appel réussi à l'API
- [ ] Les règles UX existantes sont respectées : redirection vers `/panier` si au moins un produit disponible, message si aucun produit dispo
- [ ] **Style bouton :** remplacer le style actuel par un style secondaire/discret — ex. `variant="ghost"` ou `variant="outline"` du composant `Button`, texte petit (`text-sm`), sans fond coloré plein
- [ ] Le bouton reste lisible et accessible (contraste ≥ 4.5:1) mais visuellement subordonné aux informations de la commande
- [ ] Aucune régression sur les autres parties de `HistoriqueCommandes` (commandes en cours, polling, statuts)

---

### TICK-115 — Page profil : contraste input "Nom affiché" + curseur bouton Enregistrer
**Épic :** Client / UX / Accessibilité
**Priorité :** 🟠 Haute
**Sizing :** 0,25 j
**Dépendances :** TICK-113

**Description :**
Deux anomalies UX sur la section "Nom affiché" de `/profil` :
1. Le texte dans l'`<input>` est trop clair — contraste insuffisant par rapport au fond (WCAG AA non respecté).
2. Lorsque le nom n'a pas été modifié (bouton "Enregistrer" désactivé/inactif), le curseur passe en mode `pointer` au survol du bouton, laissant croire qu'il est cliquable.

**Critères d'acceptance :**
- [ ] L'input "Nom affiché" affiche le texte saisi en `text-gray-900` (ou équivalent ≥ 4.5:1 de contraste sur fond blanc)
- [ ] Supprimer toute classe Tailwind imposant un texte trop clair (`text-gray-300`, `text-orange-200`, etc.) sur cet input
- [ ] Lorsque le bouton "Enregistrer" est désactivé (`disabled` ou état inchangé), son `cursor` est `default` (pas `pointer`)
- [ ] Implémenter via `cursor-default` Tailwind ou `disabled:cursor-default` sur le bouton — ne pas laisser le navigateur hériter d'un `cursor: pointer` du parent
- [ ] Tester les états : normal (nom modifié → pointer OK), désactivé (nom non modifié → curseur default), focus input
- [ ] Aucune régression sur les autres éléments du profil

---

### TICK-116 — Déplacer le bouton "Mon profil" du header vers `<main>`
**Épic :** Client / Navigation / Layout
**Priorité :** 🟡 Moyenne
**Sizing :** 0,25 j
**Dépendances :** TICK-074, TICK-082

**Description :**
Le bouton/lien "Mon profil" est actuellement rendu dans `HeaderAuth.tsx` (composant inclus dans le `<header>` du layout client). Il doit être déplacé dans la zone `<main>` du layout client, positionné en **haut à droite** de la zone de contenu.

**Critères d'acceptance :**
- [ ] Le bouton "Mon profil" n'apparaît plus dans le `<header>` (composant `HeaderAuth.tsx`)
- [ ] Il est rendu dans `app/(client)/layout.tsx` (ou composant dédié), à l'intérieur de la zone `<main>`, en position `absolute top-4 right-4` (ou équivalent) relativement au conteneur `<main>`
- [ ] Le conteneur `<main>` dispose de `relative` pour que le positionnement absolu fonctionne correctement
- [ ] Le bouton reste visible uniquement si `session?.user?.role === "client"` (même condition qu'avant)
- [ ] Sur toutes les pages client (menu, panier, commande, confirmation, profil) : le bouton est visible en haut à droite de la zone de contenu
- [ ] Aucune régression sur les autres éléments du header (nom du restaurant, bannière, etc.)
- [ ] Vérifier que le bouton ne chevauche pas d'autres éléments de contenu sur mobile

---

## Sprint 16 — Refactoring Admin, Palette Couleur & Correctifs (7,0 j)

> Ajouté le 2026-03-27 · Cible : iPad/tablette pour l'admin, bugfixes horaires/boutique, palette couleur dynamique, onglets commandes + export CSV.

---

### TICK-117 — Layout admin : responsive tablette (iPad first)
**Épic :** Admin / UX / Layout
**Priorité :** 🟠 Haute
**Sizing :** 0,5 j
**Dépendances :** TICK-014

**Description :**
L'interface admin est conçue pour desktop large. Elle doit être optimisée pour une utilisation sur iPad/tablette (768px–1024px) sans être mobile-first. Objectif : lisibilité maximale, sections bien délimitées, navigation claire à partir de 768px.

**Critères d'acceptance :**
- [ ] Le layout admin (`app/(admin)/layout.tsx`) définit une largeur minimale de `min-w-[768px]` — pas de scroll horizontal sur tablette
- [ ] La navigation admin (onglets ou sidebar) est lisible et cliquable au doigt (hauteur de touche ≥ 44px)
- [ ] Toutes les pages admin (`/admin`, `/admin/commandes`, `/admin/menu`, `/admin/personnalisation`) sont utilisables à 768px sans chevauchement d'éléments
- [ ] Les tableaux/listes de commandes et produits ont un scroll horizontal interne (`overflow-x-auto`) sur tablette plutôt que de casser le layout
- [ ] Les boutons d'action (modifier, supprimer, changer statut) restent visibles et cliquables sur tablette
- [ ] Aucune régression sur desktop (≥ 1024px)

---

### TICK-118 — Admin personnalisation : layout side-by-side (formulaire | rendu)
**Épic :** Admin / UX / Personnalisation
**Priorité :** 🟠 Haute
**Sizing :** 0,5 j
**Dépendances :** TICK-117, TICK-031

**Description :**
Dans `app/(admin)/personnalisation/page.tsx`, la section formulaire et la section aperçu (`PersonnalisationApercu`) sont empilées verticalement. Les mettre côte à côte : formulaire à gauche, aperçu (rendu) à droite. Cela améliore drastiquement l'utilisabilité sur tablette/desktop où l'utilisateur voit en temps réel l'impact de ses modifications.

**Critères d'acceptance :**
- [ ] Mise en page `flex flex-row gap-6` (ou `grid grid-cols-2 gap-6`) sur tablette/desktop (≥ 768px)
- [ ] Colonne gauche : formulaire de personnalisation (champs nom, couleurs, horaires, bannière)
- [ ] Colonne droite : composant `PersonnalisationApercu` — rendu en temps réel de la vitrine
- [ ] Sur mobile (< 768px) : empilement vertical conservé (formulaire au-dessus, aperçu en dessous)
- [ ] L'aperçu reste visible sans scroll vertical dès 768px (hauteur adaptée, scroll interne si nécessaire)
- [ ] Aucune régression fonctionnelle : les sauvegardes et l'aperçu temps réel fonctionnent comme avant

---

### TICK-119 — Fix : toggle "Fermer la boutique" sans effet
**Épic :** Admin / Bug / Boutique
**Priorité :** 🔴 Bloquant
**Sizing :** 0,5 j
**Dépendances :** TICK-105 (Sprint 13)

**Description :**
Le bouton "Fermer la boutique aujourd'hui" (`fermeeAujourdhui`) côté admin ne se traduit pas par un blocage effectif des commandes côté client. Le champ est peut-être bien persisté en base mais n'est pas lu correctement lors du chargement côté client, ou le fetch de `site-config` est mis en cache et retourne une valeur périmée.

**Cause probable :**
- `GET /api/site-config` est mis en cache par Next.js ou le navigateur → la valeur `fermeeAujourdhui: true` n'est pas vue côté client après modification admin.
- Ou : le code client qui vérifie `fermeeAujourdhui` n'est pas exécuté au bon endroit (ex. vérification absente dans `FormulaireCommande` ou `commande/page.tsx`).

**Critères d'acceptance :**
- [ ] Identifier le point de lecture de `fermeeAujourdhui` côté client (API + composant concerné)
- [ ] `GET /api/site-config` : ajouter `{ cache: 'no-store' }` ou `revalidate: 0` pour éviter tout cache sur cette route — la valeur doit être fraîche à chaque requête
- [ ] Si `fermeeAujourdhui === true` : la page de commande côté client affiche un message clair ("La boutique est fermée aujourd'hui") et empêche la sélection d'un créneau ou la soumission
- [ ] Après que l'admin désactive "Fermer la boutique" → le client peut à nouveau commander sans rafraîchir manuellement (au plus 1 rechargement de page)
- [ ] Test manuel : toggle ON → commande bloquée côté client, toggle OFF → commande possible

---

### TICK-120 — Fix : modification des horaires admin sans impact sur les créneaux disponibles côté client
**Épic :** Admin / Bug / Créneaux
**Priorité :** 🔴 Bloquant
**Sizing :** 1,0 j
**Dépendances :** TICK-028, TICK-119

**Description :**
Modifier les horaires d'ouverture/fermeture en admin (`horaireOuverture`, `horaireFermeture`) ne met pas à jour les créneaux disponibles côté client. Exemple : boutique ouverte de 11h30 à 14h, modification à 8h30 → client reçoit toujours "Aucun créneau disponible pour aujourd'hui. La boutique ferme bientôt." à 9h30.

**Causes probables :**
1. **Cache** : `GET /api/site-config` retourne l'ancienne valeur (idem TICK-119).
2. **Calcul des créneaux** : le calcul dans `FormulaireCommande` compare l'heure courante aux horaires lus au montage du composant — si les horaires ne sont pas rechargés, les créneaux ne se recalculent pas.
3. **Logique de "ferme bientôt"** : le message peut être généré par une condition sur `horaireFermeture` qui n'est pas recalculée après mise à jour.

**Critères d'acceptance :**
- [ ] `GET /api/site-config` retourne systématiquement les données fraîches (no-store / revalidate: 0) — même correction que TICK-119 si non déjà appliquée
- [ ] `FormulaireCommande.tsx` (ou équivalent) recharge `site-config` à chaque affichage de la page commande (pas seulement au montage initial de l'app)
- [ ] Le calcul des créneaux disponibles est effectué **après** réception des horaires frais : `horaireOuverture` et `horaireFermeture` lus depuis la config fraîche
- [ ] Test : ouvrir `/commande`, noter les créneaux, modifier les horaires en admin, recharger `/commande` → les créneaux reflètent les nouveaux horaires
- [ ] Test spécifique scénario signalé : il est 9h30, admin passe l'ouverture à 8h30 → le client peut voir des créneaux à partir de 8h30 (ou le prochain créneau ≥ heure courante)
- [ ] Le message "La boutique ferme bientôt" n'apparaît que si l'heure courante dépasse réellement `horaireFermeture` selon la config fraîche
- [ ] Aucune régression sur la génération des créneaux (intervalles 15 min, non passés, dans la plage d'ouverture)

---

### TICK-121 — Fix : section "Récupérer aujourd'hui" vide malgré des commandes récupérées
**Épic :** Admin / Bug / Dashboard
**Priorité :** 🟠 Haute
**Sizing :** 0,5 j
**Dépendances :** TICK-103 (Sprint 13)

**Description :**
La section "Récupérer aujourd'hui" dans la page admin des commandes (`/admin/commandes`) n'affiche aucune commande alors que des commandes ont été marquées comme récupérées (`statut: "recuperee"`) dans la journée.

**Cause probable :**
- Le filtre côté API ou côté UI compare `createdAt` au lieu de la date de passage en statut `"recuperee"` — or ce timestamp de transition n'est pas stocké.
- Ou : le filtre `"recuperee"` n'est pas inclus dans la requête qui alimente cette section, ou la date de comparaison utilise UTC au lieu du fuseau local.

**Critères d'acceptance :**
- [ ] Identifier la requête qui alimente la section "Récupérer aujourd'hui" (API ou filtre client)
- [ ] Corriger le filtre : inclure les commandes avec `statut: "recuperee"` **et** `createdAt` dans la journée courante (minuit → maintenant, heure locale)
- [ ] Si le problème est lié au fuseau horaire UTC/local : adapter la comparaison de dates pour utiliser le début de journée en heure locale (Paris/Europe)
- [ ] La section affiche bien les commandes récupérées du jour après correction
- [ ] Aucune régression sur les autres sections (commandes en cours, en attente)

---

### TICK-122 — Admin personnalisation : sélecteur couleur principale + génération de palette
**Épic :** Admin / Personnalisation / Design System
**Priorité :** 🟠 Haute
**Sizing :** 1,5 j
**Dépendances :** TICK-031, TICK-118

**Description :**
Remplacer les deux champs "couleur bordure gauche" et "couleur bordure droite" par un seul champ **couleur principale** (color picker). À partir de cette couleur, générer automatiquement une palette complète (teintes claires, foncées, couleur de texte contrastée) qui sera utilisée sur tout le site. La palette doit rester dans la teinte choisie et respecter les contraintes de contraste WCAG AA.

**Algorithme de génération de palette (`lib/palette.ts`) :**
```typescript
// Entrée : couleur principale hex (ex: "#E63946")
// Sortie : palette de 6 tokens
export interface SitePalette {
  primary: string;         // couleur choisie (ex: #E63946)
  primaryLight: string;    // teinte +40% luminosité (fonds, survols légers)
  primaryDark: string;     // teinte -30% luminosité (hover boutons, focus)
  primaryForeground: string; // blanc (#fff) ou noir (#111) selon contraste WCAG AA sur primary
  surface: string;         // très clair, quasi-blanc teinté (fonds de cartes)
  border: string;          // teinte moyennement saturée (séparateurs, bordures)
}
// Utiliser hsl() pour les manipulations de luminosité
// primaryForeground : choisir #fff si contrast ratio > 4.5 sur primary, sinon #111
```

**Modèle `SiteConfig` — modification :**
```typescript
// Remplacer :
couleurBordureGauche: string;
couleurBordureDroite: string;
// Par :
couleurPrincipale: string;  // hex, ex: "#E63946" — défaut: "#E63946"
```

**Critères d'acceptance :**
- [ ] `lib/palette.ts` : fonction `generatePalette(hex: string): SitePalette` exportée et testable
- [ ] La palette générée reste dans la teinte de la couleur choisie (pas de couleurs complémentaires ou analogues)
- [ ] `primaryForeground` garantit un ratio de contraste ≥ 4.5:1 sur `primary` (WCAG AA)
- [ ] `surface` est suffisamment clair pour servir de fond de carte (luminosité ≥ 92%)
- [ ] `models/SiteConfig.ts` : champ `couleurPrincipale` remplace `couleurBordureGauche/Droite` — migration `upsert` transparente (valeur par défaut `"#E63946"` si absente)
- [ ] `PUT /api/site-config` : accepte `couleurPrincipale` (string hex, validé Zod `z.string().regex(/^#[0-9a-fA-F]{6}$/)`)
- [ ] `GET /api/site-config` : retourne `couleurPrincipale` **et** la palette calculée (`palette: SitePalette`) — calculée à la volée, non stockée
- [ ] Formulaire admin (`personnalisation/page.tsx`) : `<input type="color">` pour choisir la couleur principale, avec aperçu de la palette générée (6 swatches colorés affichés)
- [ ] L'aperçu `PersonnalisationApercu` utilise la palette pour le rendu temps réel
- [ ] Aucune régression : les anciens enregistrements SiteConfig sans `couleurPrincipale` utilisent la valeur par défaut

---

### TICK-123 — Application de la palette couleur dynamique côté client
**Épic :** Client / Design System / Personnalisation
**Priorité :** 🟠 Haute
**Sizing :** 1,5 j
**Dépendances :** TICK-122

**Description :**
Injecter la palette générée (TICK-122) dans le layout client via des **CSS custom properties** (`var(--color-primary)`, etc.), et remplacer toutes les couleurs hardcodées sur les éléments visuels principaux (boutons, headers, accents, fonds de cartes) par ces variables. Le résultat : changer la couleur principale en admin re-colore instantanément tout le site client.

**Stratégie d'injection :**
```tsx
// app/(client)/layout.tsx — Server Component
const config = await fetch('/api/site-config', { cache: 'no-store' }).then(r => r.json());
const { palette } = config;

const cssVars = {
  '--color-primary': palette.primary,
  '--color-primary-light': palette.primaryLight,
  '--color-primary-dark': palette.primaryDark,
  '--color-primary-fg': palette.primaryForeground,
  '--color-surface': palette.surface,
  '--color-border': palette.border,
} as React.CSSProperties;

return <html><body style={cssVars}>{children}</body></html>;
```

**Éléments à migrer vers les CSS variables :**
- Boutons primaires (`Button` variant primary) : fond `var(--color-primary)`, texte `var(--color-primary-fg)`, hover `var(--color-primary-dark)`
- Header client (bannière, nom restaurant) : accent `var(--color-primary)`
- Cartes produits (`MenuCard`) : bordure/accent `var(--color-border)`
- Stepper commande (`CommandeStepper`) : étape active `var(--color-primary)`
- Fonds de sections légèrement teintés : `var(--color-surface)`

**Critères d'acceptance :**
- [ ] `app/(client)/layout.tsx` injecte les 6 CSS variables via `style` sur `<body>` (Server Component, pas de JS client)
- [ ] `components/ui/Button.tsx` variant `primary` utilise les CSS variables (via `style` inline ou classe Tailwind arbitraire `bg-[var(--color-primary)]`)
- [ ] `components/client/MenuCard.tsx` : au moins un élément visuel utilise `var(--color-border)` ou `var(--color-primary)`
- [ ] Changer `couleurPrincipale` en admin → recharger le site client → les couleurs sont mises à jour (sans redéploiement)
- [ ] Tous les contrastes texte/fond respectent WCAG AA (≥ 4.5:1) avec la palette par défaut ET avec une couleur sombre testée (ex: `#1a1a2e`)
- [ ] L'ancien système `couleurBordureGauche/Droite` est supprimé de tous les composants client
- [ ] Le layout admin n'est **pas** affecté par la palette client (classes admin restent hardcodées ou utilisent une palette neutre dédiée)
- [ ] Aucune régression visuelle notable sur les pages client avec la couleur par défaut

---

### TICK-124 — Admin commandes : 2 onglets "En cours" / "Passées"
**Épic :** Admin / UX / Commandes
**Priorité :** 🟠 Haute
**Sizing :** 0,5 j
**Dépendances :** TICK-015, TICK-103

**Description :**
La page `/admin/commandes` affiche toutes les commandes dans une liste unique. La diviser en **2 onglets** :
- **En cours** : statuts `payee`, `en_preparation`, `prete` — commandes actives à traiter
- **Passées** : statut `recuperee` — commandes terminées (historique)

**Critères d'acceptance :**
- [ ] Deux onglets visuels en haut de la page : "En cours" et "Passées" — onglet actif clairement mis en évidence
- [ ] **Onglet "En cours"** : affiche les commandes avec `statut` dans `["payee", "en_preparation", "prete"]`, triées par `createdAt` ASC (les plus anciennes d'abord)
- [ ] **Onglet "Passées"** : affiche les commandes avec `statut === "recuperee"`, triées par `createdAt` DESC (les plus récentes d'abord)
- [ ] Le filtre peut être côté client (state local) si toutes les commandes sont déjà chargées, ou côté API avec un paramètre `?onglet=en_cours|passees`
- [ ] La section "Récupérer aujourd'hui" (TICK-121 fixé) reste présente dans l'onglet "En cours" ou en header global
- [ ] L'onglet actif est conservé lors d'un changement de statut (pas de reset vers "En cours" après action)
- [ ] Les actions d'onglet (changement de statut, export) sont contextuelles à l'onglet actif
- [ ] Aucune régression sur les fonctionnalités existantes (changement de statut, affichage des détails)

---

### TICK-125 — Admin commandes passées : export CSV comptabilité
**Épic :** Admin / Commandes / Export
**Priorité :** 🟠 Haute
**Sizing :** 0,5 j
**Dépendances :** TICK-124, TICK-106

**Description :**
Ajouter un bouton **"Exporter CSV"** dans l'onglet "Commandes passées" pour télécharger les commandes récupérées au format CSV. Ce fichier est destiné à la comptabilité : une ligne par commande, avec les informations essentielles.

**Format CSV (séparateur `;`, encodage UTF-8 BOM pour Excel) :**
```
Date;Heure;Numéro commande;Client;Téléphone;Email;Produits;Total (€)
2026-03-15;12h30;abc123...;Jean Dupont;06 12 34 56 78;jean@example.com;"Burger x2, Frites x1";18,50
```

**Colonnes :**
- `Date` : `createdAt` au format `YYYY-MM-DD` (heure locale)
- `Heure` : `createdAt` au format `HH:MM` (heure locale)
- `Numéro commande` : `_id` tronqué (8 premiers caractères) ou `stripeSessionId` tronqué
- `Client` : `client.nom`
- `Téléphone` : `client.telephone`
- `Email` : `client.email` (vide si absent)
- `Produits` : liste concaténée `"Produit A x2, Produit B x1"` (avec options si présentes)
- `Total (€)` : `total / 100` avec virgule décimale (format français : `18,50`)

**Critères d'acceptance :**
- [ ] Bouton "Exporter CSV" visible dans l'onglet "Commandes passées" (haut ou bas de liste)
- [ ] Appel `GET /api/admin/commandes/export?statut=recuperee` — route existante (TICK-106) ou à étendre avec le filtre `statut`
- [ ] Le CSV inclut **uniquement** les commandes avec `statut: "recuperee"`
- [ ] Filtrage optionnel par période (si une plage de dates est sélectionnée dans l'UI) — le paramètre `?from=YYYY-MM-DD&to=YYYY-MM-DD` est supporté par la route
- [ ] Encodage UTF-8 avec BOM (`\uFEFF`) pour compatibilité Excel
- [ ] Header HTTP : `Content-Disposition: attachment; filename="commandes-YYYY-MM-DD.csv"`
- [ ] Les commandes anonymisées (PII remplacés par `[Supprimé]`) sont incluses telles quelles dans le CSV
- [ ] Aucune régression sur l'onglet "En cours"

---

## Tickets non-planifiés (post-MVP)

| ID | Description | Complexité |
|----|-------------|-----------|
| TICK-024 | Filtres et recherche dans la liste admin des commandes | 0,5 j |
| TICK-025 | Statistiques admin (CA journalier, produits populaires) | 1 j |
| TICK-026 | Mode hors-ligne PWA (cache menu) | 1,5 j |
| TICK-027 | Notifications push (nouvelle commande) | 2 j |

---

## Ordre de développement recommandé

```
Semaine 1 (Jours 1-5)
├── J1 : TICK-001 (Setup) + TICK-002 (MongoDB)
├── J2 : TICK-003 (Modèle Produit) + TICK-004 (Modèle Commande)
├── J3 : TICK-005 (NextAuth)
├── J4 : TICK-007 (API Produits) + TICK-006 (Page Login)
└── J5 : TICK-008 (API Commandes) + TICK-009 (Layout Client)

Semaine 2 (Jours 6-10)
├── J6 : TICK-010 (Page Menu)
├── J7 : TICK-011 (Panier localStorage)
├── J8 : TICK-012 (Formulaire Commande) + TICK-028 (Créneaux 15 min)
├── J9 : TICK-017 (Stripe Checkout)
└── J10 : TICK-018 (Webhook Stripe) + TICK-019 (Email)

Semaine 3 (Jours 11-15)
├── J11 : TICK-029 (API Suivi) + TICK-030 (Page Suivi) + TICK-014 (Layout Admin)
├── J12 : TICK-015 (Admin Commandes)
├── J13 : TICK-016 (Admin Menu)
├── J14 : TICK-020 (PWA) + TICK-021 (RGPD) + TICK-022 (Deploy)
└── J15 : TICK-023 (Recette E2E)

Semaine 4 (Jours 16-20)
├── J16 : TICK-034 (API Upload) + TICK-035 (DropZone)
├── J17 : TICK-036 (Modèle image produit) + TICK-037 (ProduitForm)
├── J18 : TICK-038 (MenuCard) + TICK-039 (Bannière upload)
└── J19 : TICK-040 (Cache RGPD)

Semaine 5 (Jours 20-25)
├── J20 : TICK-041 (Setup test infra)
├── J21 : TICK-042 (Tests utilitaires) + TICK-043 (Tests modèles — partie 1)
├── J22 : TICK-043 (Tests modèles — partie 2) + TICK-044 (Tests API produits)
├── J23 : TICK-045 (Tests API commandes) + TICK-046 (Tests checkout + webhook)
├── J24 : TICK-047 (Tests site-config + upload) + TICK-048 (Tests composants client — partie 1)
└── J25 : TICK-048 (Tests composants client — partie 2) + TICK-049 (Tests composants admin)

Semaine 6 — Sécurité & RGPD (Jours 26-31)
├── J26 : TICK-050 (Validation prix serveur) ← 🔴 Bloquant avant mise en prod
├── J27 : TICK-051 (Headers HTTP) + TICK-056 (Bandeau cookie CNIL)
├── J28 : TICK-052 (Rate limiting login) + TICK-054 (Middleware étendu)
├── J29 : TICK-053 (MIME magic bytes) + TICK-055 (Mock checkout sécurisé)
├── J30 : TICK-057 (Rétention données RGPD) + TICK-058 (Mentions légales sous-traitants)
└── J31 : TICK-059 (Logs sécurité structurés)

Semaine 7 — Corrections post-audit (Jours 32-34)
├── J32 : TICK-060 (Index TTL MongoDB + logs anonymisation) ← 🔴 Bloquant avant mise en prod
├── J33 : TICK-061 (Supprimer unsafe-eval CSP) + TICK-062 (Middleware DELETE + IP fix)
└── J34 : TICK-063 (Rate limit fail-open) + TICK-064 (console.* + Zod webhook)
```

---

---

## Éléments mis de côté — à revoir quand le dev principal est terminé

> Ces éléments ont été implémentés puis temporairement retirés de l'interface pour éviter de perturber les flux prioritaires. Le code backend reste en place et fonctionnel.

---

### Export des données personnelles (RGPD Art. 20 — droit à la portabilité)

**Mis de côté lors de :** Sprint 11.5 (2026-03-25) — TICK-093
**Code concerné :** `app/(client)/profil/page.tsx` (section "Mes données"), `app/api/client/export/route.ts`

**Ce que fait ce code :**
La route `GET /api/client/export` génère et retourne un fichier JSON contenant l'ensemble des données personnelles de l'utilisateur connecté : informations de compte (nom, email, date de création, provider d'authentification) et historique complet des commandes (produits, montants, créneaux, dates). Ce mécanisme répond au droit à la portabilité des données prévu par l'article 20 du RGPD.

**Pourquoi mis de côté :**
- L'UX de la section (bouton seul, sans explication suffisante ni confirmation) n'est pas satisfaisante
- Format JSON brut peu lisible pour un utilisateur final non-technique
- Nécessite réflexion sur : format de sortie (JSON vs PDF), confirmation avant téléchargement, wording RGPD précis

**Prérequis avant remise en production :**
- Revoir le format et la lisibilité du fichier exporté
- Ajouter une étape de confirmation ("Vous êtes sur le point de télécharger…")
- Mettre à jour la page Mentions légales pour référencer explicitement ce droit
- Tester le téléchargement sur mobile (Safari iOS)

---

*Document généré le 2026-03-17 — Version 1.4 (Sprint 7 Tests ajouté le 2026-03-18) — Version 1.5 (Sprint 8 Sécurité & RGPD ajouté le 2026-03-20, issu de l'audit sécurité complet) — Version 1.6 (Sprint 9 Corrections post-audit ajouté le 2026-03-20, issu du second audit après implémentation Sprint 8) — Version 1.7 (Sprint 11.5 Correctifs UX ajouté le 2026-03-25)*

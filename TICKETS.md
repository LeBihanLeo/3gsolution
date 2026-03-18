# Backlog de développement — Plateforme de commande en ligne
> Généré le 2026-03-17 · Basé sur ARCHITECTURE.md · Sizing en jours/dev

---

## Récapitulatif

| Sprint | Épic | Tickets | Charge totale |
|--------|------|---------|---------------|
| 1 | Setup, Modèles, Auth | TICK-001 → 008 | 5,5 j |
| 2 | API, Frontend Client | TICK-009 → 016 | 6,0 j |
| 3 | Paiement, Admin, Email, PWA, Déploiement | TICK-017 → 027 | 6,5 j |
| 4 | Créneaux 15 min & Suivi commande client | TICK-028 → 030 | 3,0 j |
| 5 | Personnalisation de la vitrine | TICK-031 → 033 | 2,0 j |
| 6 | Images produits, Upload bannière, Cache RGPD | TICK-034 → 040 | 5,5 j |
| 7 | Tests unitaires & intégration | TICK-041 → 049 | 7,0 j |
| **Total** | | **49 tickets** | **~35,5 j** |

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

### TICK-034 — API Upload d'images (Vercel Blob)
**Épic :** Upload & Stockage
**Priorité :** 🔴 Bloquant
**Sizing :** 0,5 j
**Dépendances :** TICK-005, TICK-022

**Description :**
Créer `app/api/upload/route.ts` — route POST protégée admin pour uploader un fichier image vers Vercel Blob et retourner l'URL publique persistante.

**Critères d'acceptance :**
- [ ] POST `/api/upload` : accepte un `FormData` avec un champ `file` (image uniquement)
- [ ] Vérification du type MIME : `image/jpeg`, `image/png`, `image/webp`, `image/gif` uniquement — rejet HTTP 400 sinon
- [ ] Taille maximale : 5 Mo — rejet HTTP 413 sinon
- [ ] Upload via `@vercel/blob` : `put(filename, file, { access: 'public' })`
- [ ] Retourne `{ url: string }` (URL Vercel Blob publique et permanente)
- [ ] Route protégée par `getServerSession` (admin uniquement)
- [ ] Variable d'env : `BLOB_READ_WRITE_TOKEN` (généré depuis Vercel Dashboard)
- [ ] Ajout de `BLOB_READ_WRITE_TOKEN` dans `.env.local.example`

---

### TICK-035 — Composant DropZone (réutilisable)
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
- [ ] Zone de drop avec bordure en tirets, texte indicatif "Glissez une image ici ou cliquez pour parcourir"
- [ ] `<input type="file" accept="image/*" hidden>` déclenché au clic sur la zone
- [ ] Gestion du drag : `dragover` → highlight de la zone, `dragleave` → retour normal, `drop` → upload
- [ ] Upload immédiat au dépôt/sélection : POST `FormData` vers `/api/upload`
- [ ] Indicateur de chargement pendant l'upload (spinner ou barre de progression)
- [ ] Prévisualisation de l'image après upload réussi (`<img>` avec `object-fit: cover`)
- [ ] Bouton "Supprimer l'image" (croix) sur la prévisualisation → appelle `onRemove` + efface la prévisualisation
- [ ] Si `currentImageUrl` fourni à l'initialisation → prévisualisation affichée d'emblée
- [ ] Message d'erreur inline si upload échoue (format non supporté, taille dépassée, erreur réseau)
- [ ] `aspectRatio="square"` → prévisualisation carrée (produits) ; `aspectRatio="banner"` → ratio 16:3 (bannière)
- [ ] Accessible : label associé à l'input, `aria-label` sur la zone de drop

---

### TICK-036 — Images produits : modèle + API
**Épic :** Images produits
**Priorité :** 🟠 Haute
**Sizing :** 0,5 j
**Dépendances :** TICK-003, TICK-034

**Description :**
Ajouter le champ `imageUrl` au modèle `Produit` et mettre à jour les routes API pour le lire et l'écrire.

**Critères d'acceptance :**
- [ ] `models/Produit.ts` : ajout du champ `imageUrl?: string` (optionnel) dans le schéma et l'interface `IProduit`
- [ ] `GET /api/produits` : le champ `imageUrl` est inclus dans la réponse
- [ ] `POST /api/produits` et `PUT /api/produits/[id]` : le champ `imageUrl` est accepté, validé par Zod comme `z.string().url().optional()`
- [ ] Aucune migration nécessaire : les produits existants sans image fonctionnent normalement
- [ ] `imageUrl` absent ou `null` → le produit est retourné sans ce champ (pas de valeur vide)

---

### TICK-037 — Images produits : formulaire admin (ProduitForm)
**Épic :** Images produits
**Priorité :** 🟠 Haute
**Sizing :** 0,5 j
**Dépendances :** TICK-035, TICK-036, TICK-016

**Description :**
Intégrer le composant `DropZone` dans `components/admin/ProduitForm.tsx` pour permettre l'ajout, le remplacement et la suppression d'une image par produit.

**Critères d'acceptance :**
- [ ] `DropZone` intégré sous les champs nom/description, avec `label="Image du produit"` et `aspectRatio="square"`
- [ ] À l'upload réussi (`onUploadSuccess`) : `imageUrl` du formulaire mis à jour avec l'URL retournée
- [ ] À la suppression (`onRemove`) : `imageUrl` remis à `undefined` dans le formulaire
- [ ] En mode édition : si le produit a déjà un `imageUrl`, il est passé en `currentImageUrl` au composant DropZone
- [ ] Le `imageUrl` est inclus dans le body du POST/PUT envoyé à l'API
- [ ] Pas de double upload : si l'image n'a pas changé lors d'un PUT, `imageUrl` conserve l'URL existante

---

### TICK-038 — Images produits : affichage client (MenuCard)
**Épic :** Images produits
**Priorité :** 🟠 Haute
**Sizing :** 0,5 j
**Dépendances :** TICK-036, TICK-010

**Description :**
Mettre à jour `components/client/MenuCard.tsx` pour afficher l'image du produit lorsqu'elle est disponible.

**Critères d'acceptance :**
- [ ] Si `imageUrl` présent : affichage d'un `<img>` (ou `<Image>` Next.js) en haut de la carte, ratio 4:3, `object-fit: cover`
- [ ] Si `imageUrl` absent : aucun espace vide — layout sans image (comportement actuel)
- [ ] Image lazy-loaded (`loading="lazy"`) pour ne pas pénaliser le LCP
- [ ] Domaine Vercel Blob ajouté dans `next.config.js` → `images.remotePatterns` (obligatoire pour `next/image`)
- [ ] Alt text = nom du produit
- [ ] Pas de régression sur le layout existant (nom, description, prix, bouton "Ajouter" inchangés)
- [ ] Responsive : image pleine largeur sur mobile, hauteur fixe sur desktop

---

### TICK-039 — Bannière : upload via DropZone (remplacement du champ URL)
**Épic :** Personnalisation
**Priorité :** 🟠 Haute
**Sizing :** 0,5 j
**Dépendances :** TICK-035, TICK-032, TICK-033

**Description :**
Modifier `app/(admin)/personnalisation/page.tsx` pour remplacer le champ `<input type="url">` de la bannière par le composant `DropZone`. Le champ `banniereUrl` dans `SiteConfig` reste inchangé (il stocke toujours l'URL), mais l'URL est désormais obtenue par upload plutôt que saisie manuelle.

**Critères d'acceptance :**
- [ ] Le champ `<input type="url">` de la bannière est remplacé par `<DropZone aspectRatio="banner" label="Bannière du site">`
- [ ] Si `banniereUrl` existe en base : passé en `currentImageUrl` au composant DropZone (prévisualisation au chargement)
- [ ] À l'upload réussi : `banniereUrl` du formulaire mis à jour avec l'URL Vercel Blob
- [ ] À la suppression : `banniereUrl` mis à `undefined` → PUT sauvegarde sans bannière → le layout client n'affiche plus la bannière
- [ ] L'aperçu temps réel existant (`PersonnalisationApercu`) continue de fonctionner avec la nouvelle URL
- [ ] Aucun changement sur `models/SiteConfig.ts` ni sur les routes API `GET/PUT /api/site-config`

---

### TICK-040 — Cache client RGPD (email + téléphone)
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
- [ ] Nouvelle clé localStorage : `client_cache` → `{ nom: string, telephone: string, email?: string }` (JSON)
- [ ] Checkbox `"Mémoriser mes informations sur cet appareil"` sous les champs client, **non cochée par défaut**
- [ ] Texte informatif associé à la checkbox : `"Ces informations restent sur votre appareil et ne sont jamais transmises à nos serveurs."`
- [ ] Si cache existant au chargement de la page : champs nom, téléphone, email pré-remplis **et** checkbox cochée automatiquement
- [ ] Sauvegarde uniquement au submit du formulaire (pas en temps réel)
- [ ] Si checkbox décochée au submit : supprimer le cache existant (`localStorage.removeItem('client_cache')`)
- [ ] Bouton **"Effacer mes informations"** (visible uniquement si `client_cache` existe) : vide le cache, vide les champs, décoche la checkbox
- [ ] Aucune donnée de cache envoyée au backend — les champs du formulaire restent la seule source de vérité pour le POST `/api/checkout`
- [ ] Mise à jour de `app/(client)/mentions-legales/page.tsx` (TICK-021) : ajout d'une section **"Données stockées localement"** expliquant le cache localStorage, comment le supprimer, et que ces données ne sont pas transmises
- [ ] La checkbox et le bouton "Effacer" sont stylisés de manière cohérente avec le reste du formulaire (Tailwind)
- [ ] Accessible : `<label>` associé à la checkbox, `aria-describedby` pointant vers le texte informatif

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
```

---

*Document généré le 2026-03-17 — Version 1.4 (Sprint 7 Tests ajouté le 2026-03-18)*

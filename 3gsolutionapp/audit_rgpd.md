# Audit RGPD — 3G Solution App

> **Date :** 03 avril 2026
> **Auditeur :** Winston — Expert RGPD
> **Projet :** Application de commande en ligne restaurant (Next.js + MongoDB Atlas + Stripe)
> **Version du rapport :** 1.0

---

## 1. Résumé exécutif

### Niveau de conformité global : **B+ — Bon socle, quelques lacunes à corriger**

L'application présente un niveau de conformité RGPD **supérieur à la moyenne** pour une application de restauration à ce stade de développement. Les fondamentaux sont en place : bandeau cookie conforme CNIL, droits utilisateurs implémentés (effacement, portabilité, rectification), rétention des données avec TTL automatique, sécurité robuste des mots de passe, absence totale de trackers tiers.

### Risques majeurs identifiés

| # | Risque | Niveau |
|---|--------|--------|
| R1 | Coordonnées de l'éditeur manquantes dans les mentions légales | **HIGH** |
| R2 | Email de contact pour exercice des droits manquant | **HIGH** |
| R3 | Bouton "Télécharger mes données" absent de l'UI (API existe mais inaccessible) | **HIGH** |
| R4 | Upstash Redis non déclaré comme sous-traitant (stocke des IPs) | **MEDIUM** |
| R5 | Aucun mécanisme d'exercice des droits pour les commandes invités | **MEDIUM** |
| R6 | Suppression TTL complète à 12 mois vs obligation comptable 10 ans | **MEDIUM** |

---

## 2. Analyse détaillée des traitements

### 2.1 Données collectées

#### Formulaire de commande (invités et clients connectés)
**Fichier :** `components/client/FormulaireCommande.tsx`

| Champ | Obligatoire | Base légale | Proportionnel ? |
|-------|-------------|-------------|-----------------|
| `nom` | Oui | Art. 6(1)(b) — exécution du contrat | ✅ Oui |
| `telephone` | Oui | Art. 6(1)(b) — contact retrait | ✅ Oui |
| `email` | Non (optionnel) | Art. 6(1)(b) — confirmation commande | ✅ Oui |
| `commentaire` | Non | Art. 6(1)(b) — allergies/préférences | ✅ Oui |
| `creneau` | Oui | Art. 6(1)(b) — organisation retrait | ✅ Oui |

**Verdict :** Collecte minimale et justifiée. ✅

#### Inscription compte client
**Fichier :** `app/api/client/register/route.ts`

| Champ | Base légale | Proportionnel ? |
|-------|-------------|-----------------|
| `email` | Art. 6(1)(b) — identifiant compte | ✅ Oui |
| `nom` | Art. 6(1)(b) — personnalisation, retrait | ✅ Oui |
| `telephone` | Art. 6(1)(b) — contact retrait | ✅ Oui |
| `password` (haché bcrypt) | Art. 6(1)(b) — sécurité compte | ✅ Oui |

**Google OAuth :** Seuls email + nom sont récupérés. Aucune donnée superflue (pas de photo de profil, pas de liste de contacts). ✅

#### Données dans les commandes
**Fichier :** `models/Commande.ts`

- `client.nom`, `client.telephone`, `client.email` : snapshot au moment de la commande
- `stripeSessionId` : référence de paiement (nécessaire pour support client et comptabilité)
- `commentaire` : peut contenir des informations sensibles (allergies)

**Verdict :** Proportionnel à la finalité. ✅

---

### 2.2 Stockage des données

#### Base de données — MongoDB Atlas
- URI configurée via `MONGODB_URI` en variable d'environnement. ✅
- 4 collections : `clients`, `commandes`, `produits`, `siteconfigs`.
- **Point à vérifier :** Le chiffrement au repos sur MongoDB Atlas dépend du cluster choisi (M10+ active le chiffrement par défaut). À confirmer dans la console Atlas.

#### Cookies
- **Cookie de session NextAuth** (`next-auth.session-token`) : strictement nécessaire, exempté de consentement (délibération CNIL 2020-091). ✅
- Durées : Admin 8h / Client standard 24h / Client "Se souvenir" 30 jours. ✅
- Aucun cookie de tracking ou analytique. ✅

#### localStorage
- `cookie_consent` : mémorisation du choix bandeau cookie. ✅
- `client_cache` : nom + téléphone + email formulaire invités (opt-in explicite, effacement disponible). ✅

#### Transmission à Stripe
Les métadonnées de la session Stripe Checkout contiennent `client_nom`, `client_telephone`, `client_email`, `retrait_type`, `retrait_creneau`, `commentaire`, `clientId`. Ces données transitent vers les serveurs Stripe (USA).

**Base légale du transfert :** Data Privacy Framework UE-USA (Stripe est certifié). ✅

---

### 2.3 Services tiers et transferts hors UE

| Service | Données transmises | Localisation | Garantie légale | Déclaré dans ML ? |
|---------|-------------------|--------------|-----------------|-------------------|
| **Stripe Inc.** | Nom, email, téléphone (métadonnées checkout) | USA | Data Privacy Framework | ✅ Oui |
| **Vercel Inc.** | Logs HTTP, requêtes | USA | DPA disponible | ✅ Oui |
| **MongoDB Atlas** | Toutes les données | USA (configurable) | DPA disponible | ✅ Oui |
| **Resend Inc.** | Email + nom (emails transactionnels) | USA | Politique de confidentialité | ✅ Oui |
| **Google LLC** | Email + nom (OAuth) | USA | SCC Art. 46 RGPD | ✅ Oui |
| **Upstash Redis** | Adresses IP (rate limiting) | USA/UE | À vérifier | ❌ **Absent** |
| **Vercel Blob** | Images produits et bannière | USA | DPA Vercel | ⚠️ Couvert implicitement |

**Note sur les polices Google :** `next/font/google` auto-héberge les polices (téléchargées au build). Aucune requête vers Google au chargement de page. Pas de fuite d'IP vers Google. ✅

---

## 3. Findings détaillés

---

### [R1] 🔴 HIGH — Coordonnées de l'éditeur manquantes

**Fichier :** `app/(client)/mentions-legales/page.tsx`

**Description :** Les champs `[à compléter]` sont toujours présents pour l'adresse, le numéro de téléphone et l'email de l'éditeur du site.

**Pourquoi non conforme :**
- **LCEN (Loi pour la Confiance dans l'Économie Numérique)** — Art. 6 : toute publication en ligne à caractère commercial doit identifier clairement l'éditeur (nom/raison sociale, adresse, numéro de téléphone, email).
- **RGPD Art. 13(1)(a)** : l'identité et les coordonnées du responsable de traitement doivent être communiquées lors de la collecte des données.
- Risque de mise en demeure CNIL + sanction DGCCRF.

**Recommandation :**
```tsx
// Dans mentions-legales/page.tsx, remplacer :
"[à compléter]"
// Par les vraies coordonnées :
"3G Solution — 12 rue de la Paix, 75001 Paris"
"contact@3gsolution.fr"
"+33 1 23 45 67 89"
```

---

### [R2] 🔴 HIGH — Email de contact pour exercice des droits manquant

**Fichier :** `app/(client)/mentions-legales/page.tsx`

**Description :** L'email `[email de contact à compléter]` pour l'exercice des droits RGPD (accès, effacement, portabilité) n'a pas été renseigné.

**Pourquoi non conforme :**
- **RGPD Art. 13(2)(b)** : le responsable de traitement doit fournir "les coordonnées du délégué à la protection des données, le cas échéant" et les modalités d'exercice des droits.
- Sans email de contact, les droits Art. 15-22 sont théoriquement inopérants pour les personnes qui ne disposent pas de compte (commandes invités).

**Recommandation :** Définir un email dédié (ex. `rgpd@3gsolution.fr` ou l'email de contact général) et l'insérer dans la page.

---

### [R3] 🔴 HIGH — Droit à la portabilité : API présente, UI absente

**Fichier API :** `app/api/client/export/route.ts` — implémentation correcte ✅
**Fichier UI :** `app/(client)/profil/page.tsx` — bouton supprimé (TICK-089)

**Description :** L'API `GET /api/client/export` génère bien un export JSON conforme (email, nom, téléphone, historique commandes sans données sensibles). Cependant, le bouton d'accès dans l'interface `/profil` a été retiré lors du sprint 11.5 (TICK-089 : "Section 'Mes données' retirée").

**Pourquoi non conforme :**
- **RGPD Art. 20** : le droit à la portabilité doit être **effectivement exerceable**. Avoir le droit sans moyen de l'exercer ne satisfait pas l'obligation.
- La mention légale indique que l'export est possible depuis `/profil` — c'est désormais inexact.

**Recommandation :** Réintégrer le bouton dans le profil ou dans une section dédiée :
```tsx
// Dans profil/page.tsx
<a href="/api/client/export" download="mes-donnees-3g.json">
  Télécharger mes données (RGPD)
</a>
```

---

### [R4] 🟡 MEDIUM — Upstash Redis non déclaré comme sous-traitant

**Fichier :** `app/(client)/mentions-legales/page.tsx`

**Description :** Upstash Redis est utilisé pour le rate limiting en production et stocke les adresses IP des clients (données personnelles au sens du RGPD). Il n'est pas listé dans la section "Sous-traitants".

**Pourquoi non conforme :**
- **RGPD Art. 13(1)(e)** : les destinataires des données personnelles doivent être communiqués.
- **RGPD Art. 28** : tout sous-traitant traitant des données personnelles doit faire l'objet d'un contrat de traitement des données.
- Une adresse IP est une donnée personnelle (arrêts CJUE Patrick Breyer C-582/14).

**Recommandation :**
1. Ajouter Upstash dans la section sous-traitants des mentions légales.
2. Vérifier la localisation des serveurs Upstash utilisés (configurer `us-east-1` → préférer `eu-west-1`).
3. S'assurer d'avoir signé le DPA Upstash (disponible sur leur dashboard).

---

### [R5] 🟡 MEDIUM — Commandes invités : aucun mécanisme d'exercice des droits

**Description :** Les personnes qui commandent sans créer de compte ont leurs données (nom, téléphone, éventuellement email) stockées dans la collection `commandes` pendant 12 mois. Elles n'ont aucun moyen d'exercer leurs droits (accès, effacement anticipé, rectification) car il n'existe pas d'authentification pour ces commandes.

**Pourquoi non conforme :**
- **RGPD Art. 12** : le responsable de traitement doit faciliter l'exercice des droits "sans frais et dans les meilleurs délais".
- La suppression automatique à 12 mois ne constitue pas un mécanisme d'exercice des droits : une personne peut souhaiter l'effacement immédiat (Art. 17).

**Recommandation (pragmatique) :**
- Ajouter dans les mentions légales la procédure de contact manuel (email) pour demander l'effacement d'une commande invité.
- Fournir un formulaire de contact simple : numéro de commande + téléphone → le gérant peut identifier et anonymiser la commande via l'admin.
- À terme : ajouter un endpoint `POST /api/commandes/effacer` protégé par un token envoyé par SMS/email au moment de la commande.

---

### [R6] 🟡 MEDIUM — Conflit potentiel entre TTL 12 mois et obligation comptable 10 ans

**Fichier :** `models/Commande.ts` — champ `purgeAt`, index TTL

**Description :** L'index TTL MongoDB supprime le **document entier** de la commande après 12 mois, y compris le montant total, les produits commandés et le `stripeSessionId`. Or, les justificatifs comptables sont soumis à une obligation de conservation de **10 ans** (Art. L123-22 Code de commerce + Art. L102 B du Livre des Procédures Fiscales).

**Pourquoi risqué :**
- En cas de contrôle fiscal ou litige commercial, l'absence de justificatifs de transaction peut constituer une infraction comptable.
- La CNIL et l'administration fiscale ont des exigences antagonistes sur la durée de conservation.

**Recommandation :**
```
Deux options :

Option A (recommandée) — Anonymisation partielle à 12 mois :
  Remplacer la suppression TTL par une anonymisation :
  - client.nom → "[Supprimé]"
  - client.telephone → "[Supprimé]"
  - client.email → "[Supprimé]"
  - commentaire → "[Supprimé]"
  Conservation pendant 10 ans : montant, produits (sans prix individuels), stripeSessionId, creneau
  Suppression complète à 10 ans.

Option B — Export comptable avant suppression :
  Avant la suppression TTL, exporter les données financières minimales
  vers un système comptable séparé (Stripe Dashboard suffit pour les
  justificatifs de paiement).
```

---

### [R7] 🟢 LOW — Séparation mentions légales / politique de confidentialité

**Description :** La page `/mentions-legales` combine mentions légales (LCEN) et politique de confidentialité (RGPD). C'est légalement valide mais peut nuire à la lisibilité et compliquer les futures mises à jour.

**Recommandation :** Créer une page `/confidentialite` dédiée et garder `/mentions-legales` pour les informations d'éditeur uniquement. Ce changement n'est pas urgent mais facilitera la maintenance.

---

### [R8] 🟢 LOW — Vercel Blob non listé explicitement comme sous-traitant

**Description :** Vercel Blob est couvert implicitement par la mention "Vercel Inc." dans les mentions légales, mais son rôle spécifique (stockage d'images) n'est pas précisé.

**Recommandation :** Ajouter une ligne dans le tableau des sous-traitants : "Vercel Blob (stockage d'images produits et bannière) — inclus dans le DPA Vercel".

---

### [R9] 🟢 LOW — Absence de registre des traitements (Art. 30 RGPD)

**Description :** Aucun registre des activités de traitement formel n'est présent dans le projet.

**Applicabilité :** L'obligation du registre Art. 30 s'applique aux organisations de moins de 250 personnes si les traitements "sont susceptibles d'engendrer un risque pour les droits et libertés des personnes concernées". Pour un restaurant avec gestion de commandes et compte client, c'est à la frontière.

**Recommandation :** Créer un document `registre-traitements.md` (non public) listant :
- Finalité de chaque traitement
- Catégories de données
- Base légale
- Durée de conservation
- Sous-traitants

---

## 4. Quick Wins (gains rapides, impact élevé)

Ces 4 actions peuvent être faites en moins de 2 heures et éliminent les risques HIGH :

| # | Action | Fichier | Temps estimé |
|---|--------|---------|--------------|
| QW1 | Renseigner les coordonnées de l'éditeur | `mentions-legales/page.tsx` | 5 min |
| QW2 | Renseigner l'email de contact RGPD | `mentions-legales/page.tsx` | 5 min |
| QW3 | Réintégrer le bouton "Télécharger mes données" dans `/profil` | `profil/page.tsx` | 30 min |
| QW4 | Ajouter Upstash dans la section sous-traitants | `mentions-legales/page.tsx` | 10 min |

---

## 5. Checklist de conformité

### ✅ Conforme

- [x] **Minimisation des données** — Seules les données nécessaires sont collectées (formulaire commande + compte client)
- [x] **Base légale** — Art. 6(1)(b) exécution du contrat clairement identifié
- [x] **Consentement bandeau cookie** — Bouton "Refuser" aussi visible que "Accepter" (conforme CNIL 2022)
- [x] **Pas de cookies de tracking** — Aucun analytics, aucun pixel, aucun outil de profilage
- [x] **Droit à l'effacement (Art. 17)** — `DELETE /api/client/account` avec anonymisation des commandes liées
- [x] **Droit à la portabilité (Art. 20)** — `GET /api/client/export` avec JSON structuré (API)
- [x] **Droit de rectification (Art. 16)** — Modification nom et téléphone via `/profil`
- [x] **Rétention 12 mois** — `purgeAt` + index TTL MongoDB automatique
- [x] **Tokens sécurisés** — `crypto.randomBytes(32)` pour verify/reset, expiration 24h/1h
- [x] **Mots de passe** — bcrypt cost 12, jamais stockés en clair
- [x] **Logs sans données sensibles** — Emails hashés SHA-256 tronqués dans les logs
- [x] **Opt-in cache formulaire** — Checkbox non cochée par défaut, bouton effacement disponible
- [x] **Polices auto-hébergées** — Pas de requête vers Google Fonts au runtime
- [x] **Google OAuth minimal** — Seuls email + nom récupérés
- [x] **Sous-traitants déclarés** — Stripe, Vercel, MongoDB Atlas, Resend, Google dans les mentions légales
- [x] **Transferts hors UE encadrés** — Data Privacy Framework (Stripe), SCC (Google), DPA (Vercel, Atlas)
- [x] **Sécurité robuste** — CSP nonce, headers HTTP, rate limiting, validation Zod systématique

### ❌ Non conforme / À corriger

- [ ] **[R1]** Coordonnées éditeur complètes dans les mentions légales
- [ ] **[R2]** Email de contact pour exercice des droits
- [ ] **[R3]** Accès UI au droit à la portabilité (bouton dans /profil)
- [ ] **[R4]** Upstash Redis déclaré comme sous-traitant

### ⚠️ À surveiller / Améliorer

- [ ] **[R5]** Mécanisme d'exercice des droits pour commandes invités
- [ ] **[R6]** Stratégie de rétention données fiscales vs RGPD (clarifier avec comptable)
- [ ] **[R9]** Registre des activités de traitement (Art. 30)
- [ ] **[R7]** Séparation mentions légales / politique de confidentialité (bonne pratique)

---

## 6. Résumé des actions prioritaires

```
PRIORITÉ HAUTE (à faire avant mise en production finale)
─────────────────────────────────────────────────────────
1. Renseigner toutes les coordonnées [à compléter] dans mentions-legales/page.tsx
2. Définir et renseigner un email RGPD de contact
3. Réintégrer le bouton "Télécharger mes données" dans /profil

PRIORITÉ MOYENNE (sprint prochain)
────────────────────────────────────
4. Ajouter Upstash Redis dans la section sous-traitants + vérifier DPA + préférer région EU
5. Documenter la procédure de contact pour commandes invités (email)
6. Clarifier avec le comptable la stratégie TTL vs obligation 10 ans → envisager anonymisation partielle

PRIORITÉ BASSE (backlog)
─────────────────────────
7. Créer registre-traitements.md (interne, non public)
8. Séparer /mentions-legales et /confidentialite
9. Vérifier chiffrement au repos MongoDB Atlas (console Atlas)
10. Politique suppression comptes inactifs (bonne pratique, non obligatoire)
```

---

*Rapport généré par Winston — Expert RGPD | 3G Solution App | 03 avril 2026*

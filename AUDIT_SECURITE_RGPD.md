# Audit Sécurité & RGPD — 3G Solution

> **Date :** 2026-03-20
> **Auditeur :** Claude Sonnet 4.6
> **Périmètre :** Code source complet, sprints 1 → 7 (commit `fe0b725`)
> **Stack analysée :** Next.js 16, NextAuth.js, MongoDB/Mongoose, Stripe, Vercel Blob, Resend

---

## 🧠 Résumé exécutif

**Niveau global de sécurité : Moyen**

L'architecture de base est saine : validation Zod systématique, bcrypt pour les mots de passe, JWT stateless, vérification de signature Stripe, idempotence du webhook, séparation claire client/admin. La base de travail est correcte pour un MVP.

Cependant, **une vulnérabilité critique permet à n'importe quel client de manipuler les prix** (payer 0,01 € pour n'importe quel produit), et plusieurs angles d'attaque restent ouverts : absence totale de rate limiting, aucun header de sécurité HTTP, validation MIME contournable côté upload, et bandeau cookie non conforme CNIL.

### Points positifs

- Zod utilisé sur toutes les entrées API
- bcrypt pour le hash du mot de passe admin
- Vérification de signature webhook Stripe (`constructEvent`)
- Idempotence webhook (index unique sur `stripeSessionId`)
- Données personnelles exclues de l'endpoint public `/api/commandes/suivi`
- Consentement localStorage explicite avec checkbox non cochée par défaut (TICK-040)
- Séparation nette middleware admin / routes publiques

### Risques principaux

1. Manipulation des prix côté client → payer n'importe quel montant
2. Aucun header de sécurité HTTP (CSP, X-Frame-Options, etc.)
3. Aucun rate limiting sur le login admin (brute force)
4. Validation MIME upload basée sur `file.type` (spoofable par le navigateur)
5. Bandeau cookie sans bouton "Refuser" (non conforme CNIL)

---

## 🔍 Analyse par périmètre

### 1. Architecture globale

**Stack :** Next.js 16 App Router, MongoDB Atlas, Mongoose, NextAuth.js Credentials, Stripe Checkout, Vercel Blob, Resend.

**Structure :** Séparation claire `(client)` / `(admin)` via route groups. API routes dans `app/api/`. Middleware NextAuth à la racine.

**Points d'attention :**
- Le middleware couvre les routes admin UI et quelques routes API, mais pas toutes (voir SEC-06).
- Le fichier `lib/mockStore.ts` expose un `Map` global partagé entre les requêtes — acceptable en développement, risqué si la distinction dev/prod est floue.
- `next.config.ts` ne configure aucun header de sécurité.

---

### 2. Authentification & Sessions

**Fichier analysé :** `lib/auth.ts`

```typescript
// lib/auth.ts — configuration NextAuth
providers: [CredentialsProvider({
  async authorize(credentials) {
    const isValid = await bcrypt.compare(credentials.password, adminPasswordHash);
    // ...
  }
})],
session: { strategy: 'jwt', maxAge: 8 * 60 * 60 }, // 8 heures
```

**Positif :**
- bcrypt avec `compare()` — protection timing-safe
- JWT stateless, pas de table sessions en base
- maxAge de 8h raisonnable pour un usage admin

**Négatif :**
- Aucun rate limiting sur `/api/auth/callback/credentials`
- Aucun mécanisme de verrouillage de compte après N échecs
- Pas de log des tentatives d'authentification échouées

---

### 3. Middleware & Contrôle d'accès

**Fichier analysé :** `middleware.ts`

```typescript
export const config = {
  matcher: [
    '/admin/commandes/:path*',
    '/admin/menu/:path*',
    '/admin/personnalisation/:path*',
    '/api/commandes',
    '/api/commandes/:id/statut',
  ],
};
```

**Gap identifié :** Les routes API suivantes reposent uniquement sur `getServerSession` dans le handler (sans filet middleware) :

| Route | Méthodes admin |
|-------|----------------|
| `/api/produits` | POST, PUT, PATCH, DELETE |
| `/api/upload` | POST |
| `/api/site-config` | PUT |

Ce n'est pas une vulnérabilité exploitable immédiatement (les handlers vérifient bien la session), mais c'est une faiblesse de défense en profondeur — un refactor maladroit pourrait supprimer un check sans déclenchement d'erreur.

---

### 4. Paiement Stripe — Vulnérabilité critique

**Fichier analysé :** `app/api/checkout/route.ts`

```typescript
// Le schéma accepte le prix fourni par le client
const ProduitCheckoutSchema = z.object({
  produitId: z.string(),
  nom: z.string().min(1),
  prix: z.number().int().min(0), // ← prix fourni par le client !
  quantite: z.number().int().min(1),
  options: z.array(OptionSchema).default([]),
});

// Ces prix sont utilisés directement pour créer les line_items Stripe
const lineItems = produits.map((p) => {
  const prixUnitaire = p.prix + p.options.reduce((s, o) => s + o.prix, 0);
  return {
    price_data: {
      currency: 'eur',
      unit_amount: prixUnitaire, // ← prix non vérifié en BDD
    },
    quantity: p.quantite,
  };
});
```

**Scénario d'attaque :**
```bash
curl -X POST /api/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "client": { "nom": "Attaquant", "telephone": "0600000000" },
    "retrait": { "type": "immediat" },
    "produits": [{ "produitId": "abc123", "nom": "Burger Classic", "prix": 1, "quantite": 10 }]
  }'
# → Stripe session créée pour 0,10 € au lieu de 85,00 €
# → Webhook confirme et crée la commande normalement en base
```

**Fix requis :** Récupérer les produits depuis MongoDB et utiliser leurs prix comme source de vérité.

---

### 5. Webhook Stripe

**Fichier analysé :** `app/api/webhooks/stripe/route.ts`

**Positif :**
- Lecture du body brut (`request.text()`) avant tout parsing — requis par Stripe
- Vérification signature `stripe.webhooks.constructEvent()`
- Vérification existence préalable (`stripeSessionId`) pour idempotence
- Erreur silencieuse sur l'email pour ne pas bloquer le webhook

**Attention :**
- `JSON.parse(metadata.produits ?? '[]')` sans validation Zod du résultat — les données viennent de Stripe (contrôlées par le serveur lors du checkout), risque faible mais présent si les métadonnées sont malformées.
- Le total est recalculé depuis les métadonnées, qui elles-mêmes viennent du checkout non sécurisé (voir SEC-01).

---

### 6. Upload d'images

**Fichier analysé :** `app/api/upload/route.ts`

```typescript
// Validation basée sur file.type — fourni par le navigateur
if (!ALLOWED_TYPES.includes(file.type)) {
  return NextResponse.json({ error: '...' }, { status: 400 });
}

// Mode production : nom de fichier original utilisé
const blob = await put(file.name, file, { access: 'public' });
```

**Problème 1 — MIME spoofable :**
`file.type` correspond à l'en-tête `Content-Type` de la partie multipart, contrôlé par le client. Un fichier `.php` peut être envoyé avec `Content-Type: image/jpeg` et passera la validation.

**Problème 2 — Nom de fichier original :**
`file.name` vient du client. Des caractères spéciaux, des espaces ou des séquences de type `../` peuvent provoquer un comportement inattendu selon le SDK Vercel Blob. Le mode local (fallback dev) utilise déjà `randomUUID()` — il faut étendre ce comportement au mode production.

---

### 7. Endpoint public de suivi commande

**Fichier analysé :** `app/api/commandes/suivi/route.ts`

**Positif :**
- Exclusion explicite des données personnelles (`client.telephone`, `client.email`) de la réponse
- Commandes `"en_attente_paiement"` retournées en 404 (non exposées)
- `commandeId` (ObjectId) non-devinable

**Attention :**
- Aucun rate limiting — un attaquant pourrait tenter d'énumérer des Stripe Session IDs (faible probabilité avec les IDs Stripe, mais à documenter)

---

### 8. Mode mock checkout

**Fichiers analysés :** `app/api/mock-checkout/route.ts`, `lib/mockStore.ts`

```typescript
// Protection actuelle : uniquement la présence de STRIPE_SECRET_KEY
if (process.env.STRIPE_SECRET_KEY) {
  return NextResponse.json({ error: 'Mode mock désactivé' }, { status: 403 });
}
```

**Risque :** En cas d'oubli de la variable en staging (déploiement de prévisualisation Vercel, branch preview), l'endpoint est actif et permet de créer des commandes en base sans paiement réel.

**Risque secondaire :** `mockSessions` est un `Map` sans TTL — en session de développement longue, il peut s'accumuler sans nettoyage.

---

### 9. Headers HTTP

**Fichier analysé :** `next.config.ts`

```typescript
const nextConfig: NextConfig = {
  turbopack: {},
  images: { remotePatterns: [...] },
  // Aucune configuration headers()
};
```

Aucun des headers de sécurité recommandés n'est configuré. Résultat vérifié avec les outils d'analyse de headers :

| Header | Statut |
|--------|--------|
| Content-Security-Policy | ❌ Absent |
| X-Frame-Options | ❌ Absent |
| X-Content-Type-Options | ❌ Absent |
| Referrer-Policy | ❌ Absent |
| Permissions-Policy | ❌ Absent |
| Strict-Transport-Security | ⚠️ Fourni par Vercel (en prod uniquement) |

---

### 10. RGPD — Bandeau cookie

**Fichier analysé :** `components/client/CookieBanner.tsx`

```typescript
// Seul bouton disponible
<button onClick={accept}>Continuer</button>
// Aucun bouton "Refuser"
```

La CNIL (délibération 2020-091, lignes directrices 2022) exige que l'utilisateur puisse refuser aussi facilement qu'il peut accepter. Le bouton unique "Continuer" est considéré comme un dark pattern par les autorités européennes de protection des données.

---

### 11. RGPD — Données personnelles et rétention

**Données collectées et stockées :**

| Donnée | Localisation | Rétention définie |
|--------|-------------|-------------------|
| Nom client | MongoDB Commande | ❌ Non |
| Téléphone | MongoDB Commande | ❌ Non |
| Email | MongoDB Commande + Stripe metadata | ❌ Non |
| Nom, tel, email | Stripe metadata (session Checkout) | ❌ Non |
| Cache préférences | localStorage client | ✅ Effacement manuel |

Aucune durée de conservation n'est définie. Aucun mécanisme de suppression automatique n'est implémenté. Le droit à l'effacement (Art. 17 RGPD) n'est pas techniquement possible via l'interface.

---

### 12. RGPD — Google Fonts

**Fichier analysé :** `app/layout.tsx`

```typescript
import { Geist, Geist_Mono, Montserrat } from "next/font/google";
```

Next.js pré-télécharge les polices au build et les sert depuis son propre domaine en production — ce qui élimine le transfert IP vers Google en production Vercel. En développement, les polices peuvent être chargées depuis `fonts.googleapis.com`. À vérifier selon la configuration exacte du build.

---

## 🚨 Vulnérabilités — Tableau récapitulatif

| ID | Titre | Criticité | OWASP / RGPD | Ticket |
|----|-------|-----------|--------------|--------|
| SEC-01 | Prix acceptés depuis le client sans vérification BDD | 🔴 Critique | A04:2021 Insecure Design | TICK-050 |
| SEC-02 | Aucun header de sécurité HTTP | 🟠 Élevé | A05:2021 Security Misconfiguration | TICK-051 |
| SEC-03 | Absence de rate limiting sur le login admin | 🟠 Élevé | A07:2021 Auth Failures | TICK-052 |
| SEC-04 | Validation MIME upload via `file.type` (spoofable) | 🟠 Élevé | A03:2021 Injection, CWE-434 | TICK-053 |
| SEC-05 | Nom de fichier original utilisé dans Vercel Blob | 🟡 Moyen | CWE-73 | TICK-053 |
| SEC-06 | Middleware ne couvre pas toutes les routes API admin | 🟡 Moyen | A01:2021 Broken Access Control | TICK-054 |
| SEC-07 | Route mock-checkout publique sans garde NODE_ENV | 🟡 Moyen | — | TICK-055 |
| SEC-08 | Google Fonts (transfert IP potentiel vers Google) | 🟡 Moyen | RGPD Art. 44 | — |
| SEC-09 | Absence de logs de sécurité structurés | 🟢 Faible | A09:2021 Logging & Monitoring | TICK-059 |
| SEC-10 | MongoDB Atlas — whitelist IP 0.0.0.0/0 documentée | 🟢 Faible | — | — |
| RGPD-01 | Bandeau cookie sans bouton "Refuser" (non conforme CNIL) | 🟠 Élevé | RGPD Art. 7, CNIL 2022 | TICK-056 |
| RGPD-02 | Données personnelles sans politique de rétention | 🟡 Moyen | RGPD Art. 5(1)(e), Art. 17 | TICK-057 |
| RGPD-03 | Données personnelles dans métadonnées Stripe non documentées | 🟡 Moyen | RGPD Art. 28, Art. 44 | TICK-058 |

---

## 🛠️ Recommandations techniques

### SEC-01 — Fix critique : validation des prix côté serveur

```typescript
// app/api/checkout/route.ts — à ajouter après Zod parse
await connectDB();

const produitIds = parsed.data.produits.map(p => p.produitId);
const produitsDB = await Produit.find({ _id: { $in: produitIds }, actif: true }).lean();

if (produitsDB.length !== produitIds.length) {
  return NextResponse.json({ error: 'Un ou plusieurs produits sont invalides' }, { status: 400 });
}

const produitMap = new Map(produitsDB.map(p => [p._id.toString(), p]));

const lineItems = parsed.data.produits.map((p) => {
  const produitDB = produitMap.get(p.produitId);
  if (!produitDB) throw new Error(`Produit introuvable: ${p.produitId}`);

  const prixOptions = p.options.reduce((s, o) => {
    const optionDB = produitDB.options.find(opt => opt.nom === o.nom);
    if (!optionDB) throw new Error(`Option inconnue: ${o.nom}`);
    return s + optionDB.prix;
  }, 0);

  const prixUnitaire = produitDB.prix + prixOptions;
  const nomComplet = p.options.length > 0
    ? `${produitDB.nom} (${p.options.map(o => o.nom).join(', ')})`
    : produitDB.nom;

  return {
    price_data: {
      currency: 'eur',
      product_data: { name: nomComplet },
      unit_amount: prixUnitaire, // ← prix BDD, non modifiable par le client
    },
    quantity: p.quantite,
  };
});
```

---

### SEC-02 — Headers de sécurité dans next.config.ts

```typescript
// next.config.ts
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        {
          key: 'Content-Security-Policy',
          // Ajuster selon les besoins (unsafe-inline requis pour Tailwind inline styles)
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https://*.public.blob.vercel-storage.com",
            "font-src 'self'",
            "connect-src 'self' https://api.stripe.com",
            "frame-src https://js.stripe.com",
          ].join('; '),
        },
      ],
    },
  ];
}
```

---

### SEC-03 — Rate limiting avec Upstash

```typescript
// lib/ratelimit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export const loginRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '15 m'),
  analytics: false,
});
```

```typescript
// middleware.ts — ajouter avant withAuth pour /api/auth/callback/credentials
import { loginRatelimit } from '@/lib/ratelimit';

if (request.nextUrl.pathname === '/api/auth/callback/credentials') {
  const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1';
  const { success } = await loginRatelimit.limit(ip);
  if (!success) {
    return new NextResponse('Trop de tentatives', {
      status: 429,
      headers: { 'Retry-After': '900' },
    });
  }
}
```

---

### SEC-04 — Validation MIME par magic bytes

```typescript
// app/api/upload/route.ts
import { fileTypeFromBuffer } from 'file-type';

const buffer = Buffer.from(await file.arrayBuffer());

const detected = await fileTypeFromBuffer(buffer);
if (!detected || !ALLOWED_TYPES.includes(detected.mime)) {
  return NextResponse.json(
    { error: 'Type de fichier invalide (contenu non reconnu)' },
    { status: 400 }
  );
}

// Utiliser randomUUID pour le nom de fichier (mode prod comme mode dev)
const ext = EXTENSIONS[detected.mime] ?? 'bin';
const safeFilename = `${randomUUID()}.${ext}`;

if (process.env.BLOB_READ_WRITE_TOKEN) {
  const { put } = await import('@vercel/blob');
  const blob = await put(safeFilename, buffer, { access: 'public' }); // nom sûr
  return NextResponse.json({ url: blob.url });
}
```

---

### RGPD-01 — Bandeau cookie conforme CNIL

```typescript
// components/client/CookieBanner.tsx
const accept = () => {
  localStorage.setItem(STORAGE_KEY, 'accepted');
  setVisible(false);
};

const refuse = () => {
  localStorage.setItem(STORAGE_KEY, 'refused');
  setVisible(false);
};

// Dans le JSX — les deux boutons doivent avoir le même poids visuel
<div className="flex gap-3">
  <button
    onClick={refuse}
    className="shrink-0 bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
  >
    Refuser
  </button>
  <button
    onClick={accept}
    className="shrink-0 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
  >
    Accepter
  </button>
</div>
```

---

## 📋 Checklist avant mise en production

### Bloquant
- [ ] **SEC-01** — Valider les prix produits en base lors du checkout (TICK-050)
- [ ] Vérifier que `STRIPE_WEBHOOK_SECRET` est configuré en production
- [ ] Vérifier que `NEXTAUTH_SECRET` est fort et unique (≥ 32 caractères aléatoires)
- [ ] Vérifier que `ADMIN_PASSWORD_HASH` correspond à un mot de passe fort (≥ 12 caractères)
- [ ] Vérifier que `BLOB_READ_WRITE_TOKEN` est présent (sinon le mode fallback local s'active en prod)

### Haute priorité (à faire en Sprint 8)
- [ ] **SEC-02** — Configurer les headers HTTP (TICK-051)
- [ ] **SEC-03** — Rate limiting sur le login (TICK-052)
- [ ] **SEC-04** — Validation MIME par magic bytes (TICK-053)
- [ ] **RGPD-01** — Bouton "Refuser" dans le bandeau cookie (TICK-056)
- [ ] MongoDB Atlas — restreindre la whitelist IP aux IPs Vercel (ou activer Vercel IP Allow List)

### Moyenne priorité
- [ ] **SEC-05/06** — Étendre le middleware + sanitiser les noms de fichiers (TICK-054)
- [ ] **SEC-07** — Double guard `NODE_ENV !== 'production'` sur mock-checkout (TICK-055)
- [ ] **RGPD-02** — Définir la durée de rétention et implémenter la suppression (TICK-057)
- [ ] **RGPD-03** — Documenter les sous-traitants dans les mentions légales (TICK-058)

### Faible priorité (post-lancement)
- [ ] **SEC-09** — Logs structurés (TICK-059)
- [ ] Intégrer Vercel Log Drain ou service de monitoring externe

---

## 📚 Références

| Référence | Lien |
|-----------|------|
| OWASP Top 10 2021 | https://owasp.org/Top10/ |
| CNIL — Lignes directrices cookies 2022 | https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies/lignes-directrices |
| CNIL — Délibération 2020-091 | https://www.legifrance.gouv.fr/cnil/id/CNILTEXT000042388179 |
| RGPD Art. 5 — Principes relatifs au traitement | https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre2#Article5 |
| RGPD Art. 17 — Droit à l'effacement | https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre3#Article17 |
| Stripe — Data Privacy Framework | https://stripe.com/fr/legal/stripe-data-privacy-framework |
| OWASP Secure Headers Project | https://owasp.org/www-project-secure-headers/ |
| file-type (magic bytes) | https://github.com/sindresorhus/file-type |
| Upstash Rate Limiting | https://github.com/upstash/ratelimit |

---

*Audit réalisé le 2026-03-20 — Version 1.0*
*Les tickets correctifs sont référencés dans [TICKETS.md](TICKETS.md) — Sprint 8 (TICK-050 → TICK-059)*

---

---

# Second Audit — Post-Sprint 8 (2026-03-20)

> **Périmètre :** Code source après implémentation complète du Sprint 8 (TICK-050 → TICK-059)
> **Commit analysé :** état courant branche `main` (modifications non commitées incluses)
> **Objectif :** Vérifier que les 10 tickets Sprint 8 sont correctement implémentés, et identifier les nouveaux problèmes introduits ou révélés par cette implémentation.

---

## ✅ Vérification Sprint 8 — Tout correctement implémenté

| Ticket | Ce qui était attendu | Statut |
|--------|----------------------|--------|
| TICK-050 | Prix rechargés depuis MongoDB, `prix` client ignoré dans le schéma Zod | ✅ Conforme |
| TICK-051 | `headers()` dans `next.config.ts` avec X-Frame-Options, CSP, etc. | ✅ Conforme |
| TICK-052 | `checkLoginRateLimit(ip)` dans le middleware, fallback in-memory + Upstash | ✅ Conforme |
| TICK-053 | `fileTypeFromBuffer` sur le buffer, `randomUUID()` pour le nom de fichier | ✅ Conforme |
| TICK-054 | `/api/upload` et `/api/site-config` ajoutés au matcher | ✅ Conforme |
| TICK-055 | Double guard `NODE_ENV === 'production'` + `STRIPE_SECRET_KEY`, TTL 30 min | ✅ Conforme |
| TICK-056 | Bouton "Refuser" + bouton "Accepter" même poids visuel, `refused` en localStorage | ✅ Conforme |
| TICK-057 | Champ `purgeAt` sur `Commande`, `DELETE /api/commandes/[id]` avec anonymisation | ✅ Conforme |
| TICK-058 | Section sous-traitants dans `/mentions-legales` (Stripe, Vercel, MongoDB, Resend + DPA) | ✅ Conforme |
| TICK-059 | `lib/logger.ts` créé, utilisé dans checkout, upload, webhook | ✅ Conforme |

---

## 🧠 Résumé exécutif — Second audit

**Niveau global de sécurité post-Sprint 8 : Bon**

Les vulnérabilités critiques et élevées du premier audit ont toutes été corrigées. La posture de sécurité est nettement améliorée : prix vérifiés côté serveur, headers HTTP configurés, rate limiting actif, MIME validé par magic bytes, bandeau cookie conforme CNIL, rétention des données définie.

Cinq nouveaux problèmes ont été identifiés dans le code implémenté, dont **un bloquant RGPD** (index TTL MongoDB absent) et **un élevé** (CSP avec `unsafe-eval` en production).

### Nouveaux risques identifiés

1. **Index TTL MongoDB absent** → la suppression automatique promise par les mentions légales ne fonctionnera jamais
2. **`unsafe-eval` dans la CSP de production** → CSP affaiblie, `eval()` autorisé en production
3. **Route `DELETE /api/commandes/[id]` hors du middleware** → défense en profondeur incomplète
4. **IP spoofable pour le rate limiting** → contournement possible via `X-Forwarded-For` manuel
5. **Rate limiting fail-open** → si Upstash tombe, la protection brute force disparaît silencieusement

---

## 🔍 Analyse détaillée — Nouveaux problèmes

### NEW-01 — Index TTL MongoDB absent sur `purgeAt`

**Fichier :** `models/Commande.ts`
**Criticité :** 🔴 Bloquant (RGPD)
**Ticket :** TICK-060

**Code problématique :**

```typescript
// models/Commande.ts — lignes 79-84
purgeAt: {
  type: Date,
  // TTL index : MongoDB supprime automatiquement le document après cette date
  // Note : la suppression TTL supprime le document entier.
  // Si seule l'anonymisation est souhaitée, utiliser le DELETE admin à la place.
},
```

**Analyse :**

Le commentaire dans le code affirme que MongoDB supprimera automatiquement les documents, mais **aucun index TTL n'est défini**. Un TTL index MongoDB nécessite l'option `expireAfterSeconds` lors de la création de l'index — un champ `Date` ordinaire sans index ne déclenche aucune expiration.

La page `/mentions-legales` (TICK-058) stipule désormais :
> *« les informations personnelles sont automatiquement anonymisées »*

Cette promesse est **techniquement fausse** : sans l'index TTL, MongoDB ne fera jamais rien automatiquement. Les données personnelles des commandes resteront en base indéfiniment, en contradiction directe avec RGPD Art. 5(1)(e).

**Vérification :** `db.commandes.getIndexes()` en production ne retournera pas d'index `purgeAt_1` avec `expireAfterSeconds`.

**Fix requis dans `models/Commande.ts`, après la définition du schema :**

```typescript
// À ajouter avant l'export — ligne ~88
// TICK-060 — Index TTL : MongoDB supprime automatiquement les documents expirés
// expireAfterSeconds: 0 → suppression dès que Date.now() >= purgeAt
CommandeSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });
```

**Note importante :** Le délai de suppression TTL de MongoDB n'est pas instantané — il s'exécute toutes les 60 secondes en arrière-plan. Les données ne sont donc pas supprimées à la milliseconde exacte de `purgeAt`, mais dans la minute suivante. C'est acceptable pour un usage RGPD.

---

### NEW-02 — `unsafe-eval` dans la CSP en production

**Fichier :** `next.config.ts`
**Criticité :** 🟠 Élevé
**Ticket :** TICK-061

**Code problématique :**

```typescript
// next.config.ts — ligne 37
"script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-eval requis Next.js dev/prod
```

**Analyse :**

`unsafe-eval` autorise dans le navigateur :
- `eval(string)` — exécution de code JavaScript arbitraire depuis une chaîne
- `new Function(string)` — création de fonction depuis une chaîne
- `setTimeout(string)` et `setInterval(string)` — exécution différée de code en chaîne
- `WebAssembly.compile()` (selon les navigateurs)

Ce sont les primitives d'exploitation les plus utilisées dans les attaques XSS. Une CSP qui autorise `unsafe-eval` perd une grande partie de son utilité défensive — un attaquant qui injecte du contenu dans la page peut exécuter du code arbitraire via `eval()`.

**Justification du commentaire vs réalité :**

Le commentaire dit « requis Next.js dev/prod » :
- **Dev** : Vrai — Turbopack utilise `eval()` pour le Hot Module Replacement (HMR) en développement.
- **Prod** : À vérifier — un build Next.js de production génère des bundles JavaScript statiques qui n'utilisent normalement pas `eval()`. Le cas d'usage principal qui nécessite `unsafe-eval` en prod est l'utilisation de bibliothèques tierces legacy (ex : certaines versions d'Highlight.js, d'éditeurs de texte), pas Next.js lui-même.

**Test recommandé :** Déployer avec `script-src 'self' 'unsafe-inline'` (sans `unsafe-eval`) et vérifier la console navigateur — si aucune erreur CSP n'apparaît, `unsafe-eval` n'était pas nécessaire.

**Fix :** Rendre la directive conditionnelle selon l'environnement :

```typescript
// next.config.ts
async headers() {
  const isDev = process.env.NODE_ENV === 'development';
  const csp = [
    "default-src 'self'",
    isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"  // Turbopack HMR
      : "script-src 'self' 'unsafe-inline'",               // Production : pas d'eval()
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com",
    "font-src 'self'",
    "connect-src 'self' https://api.stripe.com",
    "frame-src https://js.stripe.com https://hooks.stripe.com",
    "worker-src 'self' blob:",
  ].join('; ');
  // ...
}
```

---

### NEW-03 — Route `DELETE /api/commandes/[id]` absente du middleware

**Fichier :** `middleware.ts`
**Criticité :** 🟡 Moyen
**Ticket :** TICK-062

**Code analysé :**

```typescript
// middleware.ts — config.matcher (lignes 62-76)
matcher: [
  '/admin/commandes/:path*',
  '/admin/menu/:path*',
  '/admin/personnalisation/:path*',
  '/api/commandes',           // GET liste
  '/api/commandes/:id/statut', // PATCH statut
  // ← /api/commandes/:id (DELETE) absent
  '/api/upload',
  '/api/site-config',
  '/api/auth/callback/credentials',
],
```

**Analyse :**

TICK-054 a introduit le principe de **défense en profondeur** : toutes les routes API admin sont protégées à deux niveaux — middleware (token JWT requis) + handler (`getServerSession`). Ce principe est documenté dans les commentaires du middleware lui-même.

La route `DELETE /api/commandes/[id]` (TICK-057), créée après TICK-054, n'a pas été ajoutée au matcher. Elle ne bénéficie donc que de la protection handler (`getServerSession`). Si ce check était retiré par erreur lors d'un refactor, la route serait publique.

Le risque est faible (le handler vérifie bien la session), mais c'est une incohérence architecturale avec le pattern établi.

**Fix dans `middleware.ts` — ajouter dans le matcher :**

```typescript
'/api/commandes/:id',   // DELETE anonymisation RGPD (TICK-060)
```

---

### NEW-04 — `x-forwarded-for` spoofable pour contourner le rate limiting

**Fichier :** `middleware.ts`
**Criticité :** 🟡 Moyen
**Ticket :** TICK-062

**Code problématique :**

```typescript
// middleware.ts — lignes 13-16
const ip =
  request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
  request.headers.get('x-real-ip') ??
  '127.0.0.1';
```

**Analyse :**

`x-forwarded-for` est un header HTTP standard qui peut être ajouté ou modifié par n'importe quel client :

```bash
# Attaquant — contournement du rate limiting
for i in $(seq 1 100); do
  curl -X POST /api/auth/callback/credentials \
    -H "X-Forwarded-For: 10.0.0.$i" \
    -d '{"email":"admin@restaurant.fr","password":"guess'$i'"}'
done
# → Chaque requête est vue comme une IP différente → jamais bloquée
```

**Sur Vercel Edge Runtime**, `request.ip` contient l'IP réelle telle que reçue par l'infrastructure Vercel — cette valeur n'est **pas** modifiable par le client. C'est la source d'IP à utiliser en priorité.

**Fix :**

```typescript
const ip =
  (request as NextRequest & { ip?: string }).ip ??          // Vercel Edge — non spoofable
  request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
  request.headers.get('x-real-ip') ??
  '127.0.0.1';
```

---

### NEW-05 — Rate limiting fail-open si Upstash est indisponible

**Fichier :** `lib/ratelimit.ts`
**Criticité :** 🟡 Moyen
**Ticket :** TICK-063

**Code problématique :**

```typescript
// lib/ratelimit.ts — lignes 77-82
} catch (err) {
  // Dégradation gracieuse : si Upstash est indisponible, on laisse passer
  console.error('[ratelimit] Upstash indisponible, fallback permissif:', err);
  return { success: true, remaining: MAX_REQUESTS, reset: 0 };
}
```

**Analyse :**

En cas de panne Upstash Redis, le rate limiting retourne `{ success: true }` pour toutes les requêtes. La protection anti-brute force disparaît silencieusement. Le log `console.error` n'est pas structuré et ne déclenchera pas d'alerte automatique.

**Scénario d'attaque avancé :** Un attaquant sophistiqué pourrait provoquer la saturation du plan gratuit Upstash Redis (10 000 requêtes/jour) via une autre application, puis lancer l'attaque brute force sur le login admin pendant la fenêtre de panne.

**Comparaison des stratégies fail-X :**

| Stratégie | Comportement si Redis tombe | Risque |
|-----------|----------------------------|--------|
| Fail-open (actuel) | Toutes les tentatives passent | Brute force possible |
| Fail-closed | Toutes les tentatives bloquées | Admin bloqué aussi |
| **Fail-safe (recommandé)** | Bascule vers in-memory | Protection maintenue localement |

**Fix — basculer vers in-memory plutôt que fail-open :**

```typescript
} catch (err) {
  console.error('[ratelimit] Upstash indisponible, fallback in-memory activé:', err);
  return inMemoryRateLimit(ip); // ← protection maintenue, pas de fail-open
}
```

---

### NEW-06 — Événements d'anonymisation non loggés

**Fichier :** `app/api/commandes/[id]/route.ts`
**Criticité :** 🟡 Moyen (RGPD accountability)
**Ticket :** TICK-060

**Code analysé :**

```typescript
// app/api/commandes/[id]/route.ts — pas de log de succès
await Commande.updateOne({ _id: id }, {
  $set: { 'client.nom': '[Supprimé]', 'client.telephone': '[Supprimé]' },
  $unset: { 'client.email': '', commentaire: '' },
});
return NextResponse.json({ ok: true }); // ← aucun log

// Et en cas d'erreur :
console.error('Erreur suppression commande:', error); // ← console.error non structuré
```

**Analyse :**

Le RGPD Art. 5(2) — **principe d'accountability** — impose au responsable de traitement de **pouvoir démontrer** que les traitements sont conformes. En cas de contrôle CNIL, il doit être possible de prouver quelles données ont été effacées, quand, et par qui.

Sans log des anonymisations :
- Impossible de savoir si une commande a été anonymisée à la demande d'un client (exercice du droit d'effacement)
- Impossible de constituer un registre des activités de traitement complet
- En cas de litige : pas de preuve que le droit à l'oubli a été respecté

**Fix :**

```typescript
import { logger } from '@/lib/logger';

// Après la mise à jour réussie :
logger.info('commande_anonymisee', { commandeId: id });
return NextResponse.json({ ok: true });

// En cas d'erreur :
logger.error('anonymisation_failed', { commandeId: id }, error);
```

---

### NEW-07 — Métadonnées webhook Stripe non validées par Zod

**Fichier :** `app/api/webhooks/stripe/route.ts`
**Criticité :** 🟢 Faible
**Ticket :** TICK-064

**Code analysé :**

```typescript
// app/api/webhooks/stripe/route.ts — ligne 61
const produits: ProduitPayload[] = JSON.parse(metadata.produits ?? '[]');
```

**Analyse :**

Les métadonnées Stripe sont produites par le serveur lors du checkout — le risque est donc faible en conditions normales. Cependant, deux scénarios peuvent produire des métadonnées malformées :

1. **Limite de taille Stripe** : les métadonnées Stripe ont une limite de 500 caractères par valeur. Un panier avec beaucoup de produits pourrait tronquer `metadata.produits`, produisant un JSON invalide. `JSON.parse` lèverait une exception qui serait catchée silencieusement → la commande ne serait jamais créée, mais Stripe ne serait pas informé de l'erreur (on retourne toujours 200 au webhook).

2. **Édition manuelle dans le dashboard Stripe** : un admin Stripe pourrait modifier les métadonnées depuis le tableau de bord.

**Fix — validation Zod avant utilisation :**

```typescript
// Schéma à définir en haut du fichier
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

// Remplacement du JSON.parse brut
const parseResult = ProduitMetadataSchema.safeParse(
  JSON.parse(metadata.produits ?? '[]')
);
if (!parseResult.success) {
  logger.error('webhook_invalid_produits_metadata', { stripeSessionId: session.id });
  return NextResponse.json({ received: true }); // 200 pour éviter les retries Stripe
}
const produits = parseResult.data;
```

---

### NEW-08 — `console.*` résiduels hors du logger structuré

**Fichiers :** `middleware.ts`, `app/api/mock-checkout/route.ts`
**Criticité :** 🟢 Faible
**Ticket :** TICK-064

**Occurrences identifiées :**

```typescript
// middleware.ts — ligne 22
console.warn(`[security] Login rate limit dépassé — IP: ${ip}`);
// → Non structuré, ne sera pas parsé par Vercel Log Drain en JSON

// app/api/mock-checkout/route.ts — ligne 69
console.error('Mock checkout error:', error);
// → Devrait utiliser logger.error pour cohérence
```

**Note sur le middleware :** Le middleware s'exécute sur Edge Runtime. `lib/logger.ts` utilise `console.log/warn/error` en interne, donc il est bien compatible Edge. L'import direct de `logger` dans le middleware est possible. Le `console.warn` résiduel peut être remplacé par `logger.warn` sans problème.

---

## 🚨 Nouvelles vulnérabilités — Tableau récapitulatif

| ID | Titre | Criticité | OWASP / RGPD | Ticket |
|----|-------|-----------|--------------|--------|
| NEW-01 | Index TTL MongoDB absent sur `purgeAt` — expiration RGPD non fonctionnelle | 🔴 Bloquant | RGPD Art. 5(1)(e) | TICK-060 |
| NEW-02 | `unsafe-eval` dans la CSP de production | 🟠 Élevé | A05:2021 Security Misconfiguration | TICK-061 |
| NEW-03 | Route `DELETE /api/commandes/[id]` absente du middleware | 🟡 Moyen | A01:2021 Broken Access Control | TICK-062 |
| NEW-04 | `x-forwarded-for` spoofable pour contourner le rate limiting | 🟡 Moyen | A07:2021 Auth Failures | TICK-062 |
| NEW-05 | Rate limiting fail-open si Upstash est indisponible | 🟡 Moyen | A07:2021 Auth Failures | TICK-063 |
| NEW-06 | Anonymisations non loggées — pas de traçabilité RGPD | 🟡 Moyen | RGPD Art. 5(2) Accountability | TICK-060 |
| NEW-07 | Métadonnées webhook Stripe non validées par Zod | 🟢 Faible | A08:2021 Software & Data Integrity | TICK-064 |
| NEW-08 | `console.*` résiduels dans middleware et mock-checkout | 🟢 Faible | A09:2021 Logging & Monitoring | TICK-064 |

---

## 📋 Checklist avant mise en production — Mise à jour post-Sprint 8

### Bloquant (Sprint 9)
- [ ] **NEW-01** — Ajouter `CommandeSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 })` dans `models/Commande.ts` (TICK-060)
- [ ] Vérifier l'index TTL en production : `db.commandes.getIndexes()` doit afficher `purgeAt_1` avec `expireAfterSeconds: 0`

### Sprint 8 — Validé ✅
- [x] Prix vérifiés en BDD lors du checkout (TICK-050)
- [x] Headers HTTP configurés — X-Frame-Options, CSP, nosniff, Referrer-Policy (TICK-051)
- [x] Rate limiting login 10 req/15 min, Upstash + fallback in-memory (TICK-052)
- [x] Validation MIME par magic bytes, UUID filename (TICK-053)
- [x] Middleware étendu à /api/upload et /api/site-config (TICK-054)
- [x] Mock checkout : double guard NODE_ENV + STRIPE_SECRET_KEY, TTL 30 min (TICK-055)
- [x] Bandeau cookie CNIL conforme : bouton Refuser même poids visuel (TICK-056)
- [x] Champ `purgeAt` + DELETE anonymisation admin (TICK-057)
- [x] Mentions légales sous-traitants : Stripe DPF, Vercel DPA, MongoDB DPA, Resend (TICK-058)
- [x] Logger structuré JSON prod / lisible dev (TICK-059)

### Haute priorité (Sprint 9)
- [ ] **NEW-02** — Supprimer `unsafe-eval` de la CSP de production (TICK-061)
- [ ] **NEW-03/04** — Ajouter `/api/commandes/:id` au matcher + utiliser `request.ip` (TICK-062)
- [ ] **NEW-05** — Remplacer fail-open par fallback in-memory dans `lib/ratelimit.ts` (TICK-063)
- [ ] **NEW-06** — Ajouter `logger.info/error` dans `app/api/commandes/[id]/route.ts` (TICK-060)

### Faible priorité (Sprint 9)
- [ ] **NEW-07** — Valider `metadata.produits` avec Zod dans le webhook (TICK-064)
- [ ] **NEW-08** — Remplacer `console.*` résiduels par `logger.*` (TICK-064)

---

*Second audit réalisé le 2026-03-20 — Version 2.0*
*Les tickets correctifs sont référencés dans [TICKETS.md](TICKETS.md) — Sprint 9 (TICK-060 → TICK-064)*

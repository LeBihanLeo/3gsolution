// TICK-005 — Auth admin (credentials)
// TICK-066 — Extension : Google + client credentials
// TICK-136 — Auth admin multi-tenant : credentials stockés dans Restaurant, restaurantId dans JWT
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { headers } from 'next/headers';
import { connectDB } from '@/lib/mongodb';
import Client from '@/models/Client';
import Restaurant from '@/models/Restaurant';
import { verifyTurnstile } from '@/lib/turnstile';

// CVE-10 — Vérifier la présence de NEXTAUTH_SECRET au démarrage.
// Sans cette variable, NextAuth dérive une clé faible pour signer les JWT,
// ce qui peut permettre la falsification de tokens en environnement prévisible.
// Cette assertion lève une erreur au démarrage du serveur plutôt qu'à la première
// requête, ce qui rend le problème visible immédiatement en CI/CD.
if (!process.env.NEXTAUTH_SECRET) {
  throw new Error(
    '[auth] NEXTAUTH_SECRET est manquant. Définissez cette variable dans .env.local ' +
    '(dev) ou dans les variables d\'environnement de déploiement (production). ' +
    'Générez une valeur sécurisée avec : openssl rand -base64 32'
  );
}

export const authOptions: NextAuthOptions = {
  providers: [
    // ── Provider admin (credentials) ────────────────────────────────────────
    CredentialsProvider({
      id: 'credentials',
      name: 'Admin',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Mot de passe', type: 'password' },
        turnstileToken: { label: 'Turnstile', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const turnstileOk = await verifyTurnstile(credentials.turnstileToken);
        if (!turnstileOk) return null;

        // TICK-136 — Lecture du Restaurant depuis la DB (remplace ADMIN_EMAIL env)
        // x-tenant-id injecté par le middleware avant l'appel /api/auth/callback/credentials
        await connectDB();

        const hdrs = await headers();
        const tenantId = hdrs.get('x-tenant-id');

        // Cherche le restaurant : par tenant si disponible, sinon par email (fallback)
        const restaurant = await Restaurant.findOne(
          tenantId ? { _id: tenantId } : { adminEmail: credentials.email.toLowerCase() }
        ).select('+adminPasswordHash +stripeSecretKey +stripeWebhookSecret');

        if (!restaurant) return null;
        if (restaurant.adminEmail !== credentials.email.toLowerCase()) return null;

        const isValid = await bcrypt.compare(credentials.password, restaurant.adminPasswordHash);
        if (!isValid) return null;

        return {
          id: restaurant._id.toString(),
          email: restaurant.adminEmail,
          name: restaurant.nomRestaurant,
          role: 'admin',
          restaurantId: restaurant._id.toString(),
        };
      },
    }),

    // ── Provider client (credentials) ───────────────────────────────────────
    CredentialsProvider({
      id: 'client-credentials',
      name: 'Client',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Mot de passe', type: 'password' },
        rememberMe: { label: 'Se souvenir de moi', type: 'text' },
        turnstileToken: { label: 'Turnstile', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const turnstileOk = await verifyTurnstile(credentials.turnstileToken);
        if (!turnstileOk) return null;

        await connectDB();
        const client = await Client.findOne({ email: credentials.email.toLowerCase() });

        if (!client || !client.passwordHash) return null;

        if (!client.emailVerified) {
          throw new Error('EMAIL_NOT_VERIFIED');
        }

        const isValid = await bcrypt.compare(credentials.password, client.passwordHash);
        if (!isValid) return null;

        return {
          id: client._id.toString(),
          email: client.email,
          name: client.nom ?? client.email,
          role: 'client',
          rememberMe: credentials.rememberMe === 'true',
        };
      },
    }),

    // ── Provider Google ──────────────────────────────────────────────────────
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 jours max
  },

  pages: {
    signIn: '/admin/login',
    error: '/auth/login', // TICK-111 — erreur OAuth redirige vers login client (pas admin)
  },

  callbacks: {
    // ── signIn : upsert Google client ──────────────────────────────────────
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        try {
          await connectDB();
          const email = (user.email ?? '').toLowerCase();
          const existing = await Client.findOne({ email });

          if (existing && existing.provider === 'credentials') {
            // Compte credentials existant → liaison Google (garde le passwordHash)
            await Client.findOneAndUpdate(
              { email },
              { $set: { provider: 'both', emailVerified: true } }
            );
          } else {
            // Nouveau compte Google ou compte Google déjà connu → upsert
            await Client.findOneAndUpdate(
              { email },
              {
                $set: {
                  email,
                  nom: existing?.nom ?? user.name ?? undefined,
                  provider: existing?.provider ?? 'google',
                  emailVerified: true,
                  role: 'client',
                },
              },
              { upsert: true, new: true }
            );
          }
        } catch {
          return false;
        }
      }
      return true;
    },

    // ── jwt : injecte role + id + expiry ───────────────────────────────────
    async jwt({ token, user, account }) {
      if (user) {
        // CVE-01 — Le fallback 'client' est délibéré : le rôle 'admin' est
        // assigné uniquement par le CredentialsProvider admin (qui retourne
        // explicitement { role: 'admin' }). Utiliser 'admin' comme fallback
        // exposerait tous les utilisateurs Google à une escalade de privilège
        // si MongoDB est indisponible lors du callback signIn.
        token.role = (user as { role?: string }).role ?? 'client';
        token.id = user.id;
        // TICK-136 — restaurantId dans le JWT : permet la protection cross-tenant du middleware
        const adminUser = user as { restaurantId?: string };
        if (adminUser.restaurantId) {
          token.restaurantId = adminUser.restaurantId;
        }

        // Expiry dynamique selon rôle / rememberMe
        const rememberMe = (user as { rememberMe?: boolean }).rememberMe;
        if (token.role === 'admin') {
          token.exp = Math.floor(Date.now() / 1000) + 8 * 60 * 60;
        } else if (rememberMe) {
          token.exp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
        } else {
          token.exp = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
        }
      }

      // Pour la connexion Google : résoudre l'ID MongoDB depuis la base
      // CVE-01 — En cas d'échec DB, on invalide le token plutôt que de laisser
      // passer l'utilisateur avec un rôle incorrect (fail-closed).
      if (account?.provider === 'google' && user?.email) {
        try {
          await connectDB();
          const client = await Client.findOne({ email: user.email.toLowerCase() });
          if (client) {
            token.id = client._id.toString();
            token.role = 'client';
            token.exp = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
          } else {
            // Compte Google introuvable en base (ne devrait pas arriver après signIn)
            return { ...token, error: 'AccountNotFound' };
          }
        } catch {
          // CVE-01 — Fail-closed : si MongoDB est indisponible, invalider le token
          // plutôt que de risquer une escalade de privilège.
          return { ...token, error: 'DatabaseUnavailable' };
        }
      }

      return token;
    },

    // ── redirect : autorise les domaines tenant enregistrés ───────────────
    // Par défaut NextAuth bloque tout redirect hors NEXTAUTH_URL (protection open redirect).
    // En multi-tenant, chaque restaurant a son propre domaine → on valide en DB.
    async redirect({ url, baseUrl }) {
      // URL relative → résoudre sur la base courante
      if (url.startsWith('/')) return `${baseUrl}${url}`;

      try {
        const target = new URL(url);
        // Même origine que NEXTAUTH_URL → toujours OK
        if (target.origin === new URL(baseUrl).origin) return url;

        // Dev : autoriser les domaines *.test et *.local (simulation multi-tenant locale)
        if (process.env.NODE_ENV !== 'production') {
          const tld = target.hostname.split('.').pop();
          if (tld === 'test' || tld === 'local') return url;
        }

        // Prod : valider que le hostname est un domaine tenant enregistré en DB
        await connectDB();
        const hostname = target.hostname;
        const exists = await Restaurant.exists({
          $or: [{ domaine: hostname }, { domainesAlternatifs: hostname }],
        });
        if (exists) return url;
      } catch {
        // URL invalide ou DB indisponible → fallback baseUrl
      }

      return baseUrl;
    },

    // ── session : expose role + id ─────────────────────────────────────────
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
};

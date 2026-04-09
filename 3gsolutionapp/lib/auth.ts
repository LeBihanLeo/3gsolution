// TICK-005 — Auth admin (credentials)
// TICK-066 — Extension : Google + client credentials
// TICK-136 — Auth admin multi-tenant : credentials lus depuis Restaurant en DB
// TICK-147 — Callback redirect : émission AuthCode post-Google pour flow cross-domain
// TICK-150 — Provider cross-domain : échange RelayToken → session NextAuth
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import { connectDB } from '@/lib/mongodb';
import Client from '@/models/Client';
import Restaurant from '@/models/Restaurant';
import AuthCode from '@/models/AuthCode';
import RelayToken from '@/models/RelayToken';
import { verifyTurnstile } from '@/lib/turnstile';
import { resolveTenantId } from '@/lib/tenant';
import { assertKnownDomain } from '@/lib/auth/assert-known-domain';
import { logger } from '@/lib/logger';

if (!process.env.NEXTAUTH_SECRET) {
  throw new Error(
    '[auth] NEXTAUTH_SECRET est manquant. Définissez cette variable dans .env.local ' +
    '(dev) ou dans les variables d\'environnement de déploiement (production). ' +
    'Générez une valeur sécurisée avec : openssl rand -base64 32'
  );
}

export const authOptions: NextAuthOptions = {
  providers: [
    // ── Provider admin (credentials) — TICK-136 multi-tenant ────────────────
    CredentialsProvider({
      id: 'credentials',
      name: 'Admin',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Mot de passe', type: 'password' },
        turnstileToken: { label: 'Turnstile', type: 'text' },
        // Le host est transmis par le formulaire login pour identifier le tenant
        tenantHost: { label: 'Tenant Host', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const turnstileOk = await verifyTurnstile(credentials.turnstileToken);
        if (!turnstileOk) return null;

        await connectDB();

        // TICK-136 — Résoudre le tenant depuis le host transmis par le formulaire
        const host = credentials.tenantHost ?? 'localhost';
        const restaurantId = await resolveTenantId(host);

        if (!restaurantId) {
          console.error('[auth] Tenant non résolu pour le host:', host);
          return null;
        }

        // Charger le restaurant avec adminPasswordHash (select: false par défaut)
        const restaurant = await Restaurant.findById(restaurantId)
          .select('+adminPasswordHash')
          .lean();

        if (!restaurant) {
          console.error('[auth] Restaurant introuvable:', restaurantId);
          return null;
        }

        if (credentials.email !== restaurant.adminEmail) return null;

        const isValid = await bcrypt.compare(credentials.password, restaurant.adminPasswordHash);
        if (!isValid) return null;

        return {
          id: restaurantId,
          email: restaurant.adminEmail,
          name: restaurant.nom,
          role: 'admin',
          restaurantId,
          restaurantDomain: restaurant.domaine,
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

    // ── Provider super-admin (credentials) — TICK-138 ───────────────────────
    CredentialsProvider({
      id: 'superadmin-credentials',
      name: 'SuperAdmin',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const superEmail = process.env.SUPERADMIN_EMAIL;
        const superHash = process.env.SUPERADMIN_PASSWORD_HASH;

        if (!superEmail || !superHash) {
          console.error('[auth] SUPERADMIN_EMAIL ou SUPERADMIN_PASSWORD_HASH manquants');
          return null;
        }

        if (credentials.email !== superEmail) return null;

        const isValid = await bcrypt.compare(credentials.password, superHash);
        if (!isValid) return null;

        return {
          id: 'superadmin',
          email: superEmail,
          name: 'Super Admin',
          role: 'superadmin',
        };
      },
    }),

    // ── Provider Google ──────────────────────────────────────────────────────
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),

    // ── Provider cross-domain (TICK-150) ─────────────────────────────────────
    // Reçoit un RelayToken (TTL 10s) et crée la session NextAuth côté restaurant.
    // Appelé uniquement depuis la page /auth/completing après l'échange server-to-server.
    CredentialsProvider({
      id: 'cross-domain',
      name: 'Cross-Domain',
      credentials: { t: { label: 'Relay Token', type: 'text' } },
      async authorize(credentials) {
        if (!credentials?.t) return null;
        await connectDB();
        // findOneAndDelete = atomique : lit ET supprime (usage unique garanti)
        const relay = await RelayToken.findOneAndDelete({ token: credentials.t });
        if (!relay) return null;
        // Upsert client — cohérent avec le provider Google existant
        const client = await Client.findOneAndUpdate(
          { email: relay.email.toLowerCase() },
          {
            $set: {
              email: relay.email.toLowerCase(),
              provider: 'google',
              emailVerified: true,
              role: 'client',
            },
            $setOnInsert: { nom: relay.name },
          },
          { upsert: true, new: true }
        );
        logger.info('cross_domain_session_created', { email: relay.email });
        return {
          id: client._id.toString(),
          email: client.email,
          name: client.nom ?? relay.name ?? client.email,
          role: 'client',
        };
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },

  pages: {
    signIn: '/admin/login',
    error: '/auth/login',
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
            await Client.findOneAndUpdate(
              { email },
              { $set: { provider: 'both', emailVerified: true } }
            );
          } else {
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

    // ── jwt : injecte role + id + restaurantId + expiry ────────────────────
    async jwt({ token, user, account }) {
      if (user) {
        token.role = (user as { role?: string }).role ?? 'client';
        token.id = user.id;

        // TICK-136 — restaurantId et restaurantDomain pour la protection cross-tenant
        const u = user as { restaurantId?: string; restaurantDomain?: string; rememberMe?: boolean };
        if (u.restaurantId) token.restaurantId = u.restaurantId;
        if (u.restaurantDomain) token.restaurantDomain = u.restaurantDomain;

        const rememberMe = u.rememberMe;
        if (token.role === 'admin') {
          token.exp = Math.floor(Date.now() / 1000) + 8 * 60 * 60;
        } else if (token.role === 'superadmin') {
          token.exp = Math.floor(Date.now() / 1000) + 4 * 60 * 60;
        } else if (rememberMe) {
          token.exp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
        } else {
          token.exp = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
        }
      }

      // Pour la connexion Google : résoudre l'ID MongoDB depuis la base
      if (account?.provider === 'google' && user?.email) {
        try {
          await connectDB();
          const client = await Client.findOne({ email: user.email.toLowerCase() });
          if (client) {
            token.id = client._id.toString();
            token.role = 'client';
            token.exp = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
          } else {
            return { ...token, error: 'AccountNotFound' };
          }
        } catch {
          return { ...token, error: 'DatabaseUnavailable' };
        }
      }

      return token;
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

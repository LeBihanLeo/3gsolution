// TICK-005 — Auth admin (credentials)
// TICK-066 — Extension : Google + client credentials
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/mongodb';
import Client from '@/models/Client';

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
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

        if (!adminEmail || !adminPasswordHash) {
          console.error('Variables ADMIN_EMAIL ou ADMIN_PASSWORD_HASH manquantes');
          return null;
        }

        if (credentials.email !== adminEmail) return null;

        const isValid = await bcrypt.compare(credentials.password, adminPasswordHash);
        if (!isValid) return null;

        return { id: '1', email: adminEmail, name: 'Admin', role: 'admin' };
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
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

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

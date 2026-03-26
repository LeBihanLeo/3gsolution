// TICK-005 — Auth admin (credentials)
// TICK-066 — Extension : Google + client credentials
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/mongodb';
import Client from '@/models/Client';

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

          // Email déjà enregistré en credentials → conflit explicite, pas de fusion
          if (existing && existing.provider === 'credentials') {
            return '/auth/login?error=OAuthAccountNotLinked';
          }

          // Upsert : créer ou mettre à jour le client Google
          await Client.findOneAndUpdate(
            { email },
            {
              $set: {
                email,
                nom: user.name ?? undefined,
                provider: 'google',
                emailVerified: true,
                role: 'client',
              },
            },
            { upsert: true, new: true }
          );
        } catch {
          return false;
        }
      }
      return true;
    },

    // ── jwt : injecte role + id + expiry ───────────────────────────────────
    async jwt({ token, user, account }) {
      if (user) {
        token.role = (user as { role?: string }).role ?? 'admin';
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
      if (account?.provider === 'google' && user?.email) {
        try {
          await connectDB();
          const client = await Client.findOne({ email: user.email.toLowerCase() });
          if (client) {
            token.id = client._id.toString();
            token.role = 'client';
            token.exp = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
          }
        } catch {
          // token reste valide avec l'ID Google sub comme fallback
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

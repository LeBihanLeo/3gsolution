import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/mongodb';
import Client from '@/models/Client';

function glidingPurgeAt(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + 36);
  return d;
}

export const authOptions: NextAuthOptions = {
  providers: [
    // ── Admin ────────────────────────────────────────────────────────────────
    // IMPORTANT : id explicite requis — le middleware et la page /admin/login
    // utilisent signIn('admin-credentials', ...) pour cibler ce provider.
    CredentialsProvider({
      id: 'admin-credentials',
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

    // ── Client — email + mot de passe ────────────────────────────────────────
    CredentialsProvider({
      id: 'client-credentials',
      name: 'Client',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        await connectDB();
        const client = await Client.findOne({
          email: credentials.email.toLowerCase().trim(),
          actif: true,
        });

        if (!client || !client.passwordHash) return null;

        const isValid = await bcrypt.compare(credentials.password, client.passwordHash);
        if (!isValid) return null;

        // Mise à jour de la fenêtre glissante RGPD
        const now = new Date();
        await Client.updateOne(
          { _id: client._id },
          { lastLoginAt: now, purgeAt: glidingPurgeAt() }
        );

        return {
          id: client._id.toString(),
          email: client.email,
          name: client.nom ?? null,
          role: 'client',
        };
      },
    }),

    // ── Client — Google OAuth2 ────────────────────────────────────────────────
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 heures
  },

  pages: {
    signIn: '/admin/login',
    // La page /mon-compte gère elle-même sa redirection vers /connexion
    // pour ne pas exposer /admin/login aux clients.
  },

  callbacks: {
    async jwt({ token, user, account }) {
      // ── Connexion initiale via credentials (admin ou client) ──
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }

      // ── Connexion initiale via Google OAuth ──
      // account est défini uniquement lors du premier login, pas aux refreshs suivants.
      if (account?.provider === 'google' && token.email) {
        await connectDB();
        const now = new Date();

        // Upsert : crée ou met à jour le compte client Google.
        // Le filtre sur email permet de fusionner un compte credentials existant avec Google.
        const client = await Client.findOneAndUpdate(
          { email: token.email.toLowerCase() },
          {
            $set: {
              googleId: token.sub,
              provider: 'google',
              nom: token.name ?? undefined,
              actif: true,
              lastLoginAt: now,
              purgeAt: glidingPurgeAt(),
            },
            $setOnInsert: {
              consentementMarketing: false,
              consentementDate: now,
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        token.id = client._id.toString();
        token.role = 'client';
      }

      return token;
    },

    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },
  },
};

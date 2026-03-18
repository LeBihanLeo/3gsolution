import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware() {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

// Protège toutes les routes admin (sauf /admin/login géré par NextAuth)
// et toutes les API de commandes
export const config = {
  matcher: [
    '/admin/commandes/:path*',
    '/admin/menu/:path*',
    '/admin/personnalisation/:path*',
    // Protège toutes les routes commandes SAUF /api/commandes/suivi (publique)
    '/api/commandes',
    '/api/commandes/:id/statut',
  ],
};

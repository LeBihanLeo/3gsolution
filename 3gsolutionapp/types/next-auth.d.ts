import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: 'admin' | 'client';
    };
  }
  interface User {
    id: string;
    role: 'admin' | 'client';
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: 'admin' | 'client';
  }
}

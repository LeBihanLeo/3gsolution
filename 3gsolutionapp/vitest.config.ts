import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['lib/**', 'models/**', 'app/api/**', 'components/**'],
      exclude: [
        'lib/mongodb.ts',
        'lib/stripe.ts',
        'lib/mockStore.ts',
        // Wrappers tiers non testables unitairement (comme lib/stripe.ts)
        'lib/auth.ts',
        'lib/email.ts',
        // Route dev uniquement, hors scope production
        'app/api/mock-checkout/**',
        // Composants PWA / nav / bannière sans logique métier testable
        'components/SwRegister.tsx',
        'components/admin/AdminNav.tsx',
        'components/client/CookieBanner.tsx',
      ],
      thresholds: {
        lines: 70,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});

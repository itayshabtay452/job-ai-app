// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'), // מפה את "@/..." לשורש הפרויקט
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    exclude: [
      'tests/smoke/**',
      'node_modules/**',
      'dist/**',
      '.next/**',
      '.vercel/**',
      'coverage/**',
    ],
    environment: 'node',
    globals: true,
    coverage: {
      reporter: ['text', 'html'],
      include: ['lib/**', 'app/api/**'],
    },
  },
});

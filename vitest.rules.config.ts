import { defineConfig } from 'vitest/config';

/** Configuración de Vitest para probar las reglas de Firestore en el emulador. */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20_000,
    hookTimeout: 60_000,
    fileParallelism: false
  }
});

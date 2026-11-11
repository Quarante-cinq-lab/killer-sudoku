import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['engine/**/*.test.ts', 'scripts/**/*.test.ts', 'app/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60_000,
  },
});

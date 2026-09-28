import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@components': resolve(import.meta.dirname, 'src/components'),
      '@layouts': resolve(import.meta.dirname, 'src/layouts'),
      '@utils': resolve(import.meta.dirname, 'src/utils'),
    },
  },
});

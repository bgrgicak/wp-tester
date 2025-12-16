import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@wp-tester/runtime': resolve(__dirname, 'packages/runtime/src/index.ts'),
      '@wp-tester/config': resolve(__dirname, 'packages/config/src/index.ts'),
      '@wp-tester/results': resolve(__dirname, 'packages/results/src/index.ts'),
      '@wp-tester/smoke-tests': resolve(__dirname, 'packages/smoke-tests/src/index.ts'),
      '@wp-tester/test-fixtures': resolve(__dirname, 'packages/test-fixtures/src/index.js'),
    },
  },
  test: {
    globals: true,
    environment: "node",
    exclude: ["**/dist/**"],
  },
});

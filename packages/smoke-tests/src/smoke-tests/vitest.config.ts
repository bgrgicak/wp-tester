import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import type { WPTesterConfig } from '@wp-tester/config';

declare module 'vitest' {
  export interface ProvidedContext {
    config: WPTesterConfig;
  }
}

export default defineConfig({
  resolve: {
    alias: {
      '@wp-tester/runtime': resolve(__dirname, '../../../runtime/src/index.ts'),
      '@wp-tester/config': resolve(__dirname, '../../../config/src/index.ts'),
      '@wp-tester/results': resolve(__dirname, '../../../results/src/index.ts'),
    },
  },
  test: {
    include: ["*.spec.ts"],
    passWithNoTests: true,
    hookTimeout: 120000, // 120s timeout for WordPress boot
    testTimeout: 120000, // 120s timeout for individual tests
    // Retry flaky tests in CI to handle transient WordPress Playground boot failures
    retry: process.env.CI ? 2 : 0,
    // Limit parallelism to reduce resource contention in CI
    maxConcurrency: process.env.CI ? 1 : 5,
    provide: {
      config: {
        environments: [],
        tests: {},
      } as WPTesterConfig,
    },
  },
});

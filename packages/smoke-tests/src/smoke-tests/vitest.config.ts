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
    hookTimeout: 60000, // 60s timeout for WordPress boot
    provide: {
      config: {
        environments: [],
        tests: {},
      } as WPTesterConfig,
    },
  },
});

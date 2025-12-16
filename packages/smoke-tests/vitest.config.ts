import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from '../../vitest.config.js';
import type { WPTesterConfig } from '@wp-tester/config';

declare module 'vitest' {
  export interface ProvidedContext {
    config: WPTesterConfig;
  }
}

export default mergeConfig(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  baseConfig as any,
  defineConfig({
    test: {
      exclude: ["**/src/smoke-tests/*.spec.ts"],
      passWithNoTests: true,
      provide: {
        config: {
          environments: [],
          tests: {},
        } as WPTesterConfig,
      },
    },
  })
);

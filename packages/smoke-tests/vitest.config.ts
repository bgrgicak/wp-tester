import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from '../../vitest.config';
import type { WPTesterConfig } from '@wp-tester/config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
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

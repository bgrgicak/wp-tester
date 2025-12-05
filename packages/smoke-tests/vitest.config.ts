import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from '../../vitest.config';
import type { Environment, Tests } from '@wp-tester/config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      passWithNoTests: true,
      provide: {
        environments: [] as Environment[],
        tests: {} as Tests,
      },
    },
  })
);

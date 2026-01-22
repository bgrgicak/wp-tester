import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from '../../vitest.config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      passWithNoTests: true,
      // No timeout - real-world plugin tests can take a very long time (AMP has 2841 tests)
      testTimeout: 0,
      hookTimeout: 0, // No timeout for setup hooks (cloning repos, composer install)
      // Parallel execution is now safe - startPlayground uses a mutex to prevent download race conditions
      fileParallelism: true,
      // Exclude compatibility tests from regular test runs
      // Use npm run test:compatibility to run them separately
      exclude: ['**/node_modules/**', '**/dist/**', '**/tests/compatibility/**'],
    },
  })
);

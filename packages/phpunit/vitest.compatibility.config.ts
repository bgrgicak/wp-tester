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
      // Tests run in parallel - the global mutex in startPlayground() serializes
      // WordPress Playground downloads to prevent race conditions
      fileParallelism: true,
      // Only run compatibility tests
      include: ['**/tests/compatibility/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    },
  })
);

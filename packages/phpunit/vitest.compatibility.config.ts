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
      // Run tests sequentially to avoid WordPress Playground download race conditions
      // Multiple parallel tests downloading the same WordPress version cause ENOENT errors
      // when trying to rename .zip.partial files
      fileParallelism: false,
      // Only run compatibility tests
      include: ['**/tests/compatibility/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    },
  })
);

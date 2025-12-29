import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from '../../vitest.config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      passWithNoTests: true,
      // Increase timeout for WordPress Playground initialization
      testTimeout: 180000, // 180s timeout
      // Run tests sequentially to avoid WordPress Playground download race conditions
      fileParallelism: false,
    },
  })
);

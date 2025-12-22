import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from '../../vitest.config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      passWithNoTests: true,
      // Increase timeout for WordPress Playground initialization (downloads on first run)
      testTimeout: 180000, // 180s timeout
    },
  })
);

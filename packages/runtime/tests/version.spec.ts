import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startPlayground, stopPlayground, getWordPressVersion } from '../src/index.js';
import type { RunCLIServer } from '../src/index.js';
import type { ResolvedEnvironment } from '@wp-tester/config';

// Check if we have network access
// We use this to skip integration tests that require downloading WordPress
function hasNetworkAccess(): boolean {
	try {
		const {execSync} = require('child_process');
		execSync('node -e "require(\'dns\').lookup(\'wordpress.org\', (e) => process.exit(e ? 1 : 0))"', {
			stdio: 'pipe',
			timeout: 2000,
		});
		return true;
	} catch {
		return false;
	}
}

const skipTests = !hasNetworkAccess();
if (skipTests) {
	console.warn("Skipping WordPress version test: No network access");
}

describe('getWordPressVersion', () => {
  let playground: RunCLIServer;

  beforeAll(async () => {
    const environment: ResolvedEnvironment = {
      name: 'test',
      blueprint: {
        landingPage: '/',
        preferredVersions: {
          php: '8.0',
          wp: '6.4',
        },
      },
      mounts: [],
    };
    playground = await startPlayground(environment);
  }, 180000); // 3 min for WordPress Playground setup

  afterAll(() => {
    if (playground) {
      stopPlayground(playground);
    }
  });

  it.skipIf(skipTests)('should detect WordPress version from running instance', async () => {
    const version = await getWordPressVersion(playground.playground);
    expect(version).toMatch(/^\d+\.\d+(\.\d+)?$/); // Matches X.Y or X.Y.Z
    expect(version.length).toBeGreaterThan(0);
  });
});

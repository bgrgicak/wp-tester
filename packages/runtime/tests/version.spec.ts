import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startPlayground, stopPlayground, getWordPressVersion } from '../src/index.js';
import type { RunCLIServer } from '../src/index.js';
import type { ResolvedEnvironment } from '@wp-tester/config';
import { execSync } from 'child_process';

// Check if we have network access
function hasNetworkAccess(): boolean {
	try {
		// Try to resolve wordpress.org DNS
		execSync("getent hosts wordpress.org || nslookup wordpress.org || ping -c 1 -W 1 wordpress.org", {
			stdio: "pipe",
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

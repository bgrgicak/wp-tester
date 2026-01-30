import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startPlayground, stopPlayground, getWordPressVersion } from '../src/index.js';
import type { RunCLIServer } from '../src/index.js';
import type { ResolvedEnvironment } from '@wp-tester/config';

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
      env: {},
      skip: false,
    };
    playground = await startPlayground(environment);
  }, 180000); // 3 min for WordPress Playground setup

  afterAll(() => {
    if (playground) {
      stopPlayground(playground);
    }
  });

  it('should detect WordPress version from running instance', async () => {
    const version = await getWordPressVersion(playground.playground);
    expect(version).toMatch(/^\d+\.\d+(\.\d+)?(-[A-Za-z0-9]+)?$/); // Matches X.Y, X.Y.Z, or X.Y.Z-RC1
    expect(version.length).toBeGreaterThan(0);
  });
});

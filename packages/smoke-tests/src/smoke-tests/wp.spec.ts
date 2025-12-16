import { describe, it, expect, beforeAll, afterAll, inject } from 'vitest';
import type { WPTesterConfig } from '@wp-tester/config';
import { startPlayground, stopPlayground, request, type RunCLIServer } from '@wp-tester/runtime';
import { phpVar } from '@php-wasm/util';
import { login } from '@wp-playground/blueprints';

// Get config from Vitest's provide/inject
const config = inject('config') as WPTesterConfig;
const environments = config.environments;

// Test each environment
describe.each(environments)('WordPress Tests - $name', (environment) => {
  let runtime: RunCLIServer;
  let playground: RunCLIServer['playground'];
  let documentRoot: string;
  let bootError: Error | undefined;

  beforeAll(async () => {
    try {
      runtime = await startPlayground(environment);
      playground = runtime.playground;
      documentRoot = await playground.documentRoot;
    } catch (error) {
      bootError = error as Error;
    }
  });

  afterAll(() => {
    stopPlayground(runtime);
  });

  describe('boot', () => {
    it('should boot without errors', ({ task }) => {
      if (bootError) {
        task.meta['error'] = {
          message: bootError?.message,
          stack: bootError?.stack,
        };
      }
      expect(bootError).toBeUndefined();
    });
  });

  describe.skipIf(bootError)('wordpress', () => {
    it('create a post', async () => {
      const postTitle = 'Test Post';
      const postContent = 'Test content';
      const result = await playground.run({
        code: `<?php
          require_once "${documentRoot}/wp-load.php";
          $post_id = wp_insert_post([
            'post_title' => ${phpVar(postTitle)},
            'post_content' => ${phpVar(postContent)},
          ]);
          $post = get_post($post_id);
          echo json_encode($post);
        ?>`,
      });

      const post = result.json;
      expect(post.post_title).toBe(postTitle);
      expect(post.post_content).toBe(postContent);
    });

    it('should load wp-admin', async () => {
      // Use the login blueprint step to authenticate
      await login(playground, {
        username: 'admin',
      });

      // Access wp-admin - the cookie jar will handle cookies automatically
      const response = await request(playground, {
        url: '/wp-admin/',
        method: 'GET',
      });

      expect(response.httpStatusCode).toBe(200);
      expect(response.text).toContain('Dashboard');
    });
  });
});

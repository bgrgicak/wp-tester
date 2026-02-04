import { describe, it, expect } from 'vitest';
import { extractPluginSlug, extractThemeSlug, deriveProjectSlug } from '../src/test-resolver.js';

describe('extractPluginSlug', () => {
  it('should extract slug from standard plugin path', () => {
    expect(extractPluginSlug('/wordpress/wp-content/plugins/my-plugin')).toBe('my-plugin');
  });

  it('should extract slug from plugin path with trailing slash', () => {
    expect(extractPluginSlug('/wordpress/wp-content/plugins/my-plugin/')).toBe('my-plugin');
  });

  it('should extract slug from deeply nested plugin path', () => {
    expect(extractPluginSlug('/wordpress/wp-content/plugins/my-plugin/src/includes')).toBe('my-plugin');
  });

  it('should return undefined for non-plugin paths', () => {
    expect(extractPluginSlug('/wordpress/wp-content/themes/my-theme')).toBeUndefined();
  });

  it('should return undefined for root wordpress path', () => {
    expect(extractPluginSlug('/wordpress')).toBeUndefined();
  });

  it('should return undefined for wp-content path', () => {
    expect(extractPluginSlug('/wordpress/wp-content')).toBeUndefined();
  });
});

describe('extractThemeSlug', () => {
  it('should extract slug from standard theme path', () => {
    expect(extractThemeSlug('/wordpress/wp-content/themes/my-theme')).toBe('my-theme');
  });

  it('should extract slug from theme path with trailing slash', () => {
    expect(extractThemeSlug('/wordpress/wp-content/themes/my-theme/')).toBe('my-theme');
  });

  it('should extract slug from deeply nested theme path', () => {
    expect(extractThemeSlug('/wordpress/wp-content/themes/my-theme/template-parts')).toBe('my-theme');
  });

  it('should return undefined for non-theme paths', () => {
    expect(extractThemeSlug('/wordpress/wp-content/plugins/my-plugin')).toBeUndefined();
  });

  it('should return undefined for root wordpress path', () => {
    expect(extractThemeSlug('/wordpress')).toBeUndefined();
  });

  it('should return undefined for wp-content path', () => {
    expect(extractThemeSlug('/wordpress/wp-content')).toBeUndefined();
  });
});

describe('deriveProjectSlug', () => {
  it('should derive plugin slug when projectType is plugin', () => {
    expect(deriveProjectSlug('/wordpress/wp-content/plugins/my-plugin', 'plugin')).toBe('my-plugin');
  });

  it('should derive theme slug when projectType is theme', () => {
    expect(deriveProjectSlug('/wordpress/wp-content/themes/my-theme', 'theme')).toBe('my-theme');
  });

  it('should return undefined for plugin path when projectType is theme', () => {
    expect(deriveProjectSlug('/wordpress/wp-content/plugins/my-plugin', 'theme')).toBeUndefined();
  });

  it('should return undefined for theme path when projectType is plugin', () => {
    expect(deriveProjectSlug('/wordpress/wp-content/themes/my-theme', 'plugin')).toBeUndefined();
  });

  it('should return undefined for wordpress projectType', () => {
    expect(deriveProjectSlug('/wordpress', 'wordpress')).toBeUndefined();
  });

  it('should return undefined for wp-content projectType', () => {
    expect(deriveProjectSlug('/wordpress/wp-content', 'wp-content')).toBeUndefined();
  });

  it('should return undefined for other projectType', () => {
    expect(deriveProjectSlug('/project', 'other')).toBeUndefined();
  });
});

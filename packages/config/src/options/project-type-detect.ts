// TODO: Replace these copied functions with imports from @wp-playground/cli/mounts
// once that package exports them properly.
// These functions are copied from:
// https://github.com/WordPress/wordpress-playground/blob/trunk/packages/playground/cli/src/mounts.ts

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

export type ProjectType = 'plugin' | 'theme' | 'wp-content' | 'wordpress' | 'other';

/**
 * Check if directory contains a full WordPress installation
 * (wp-admin, wp-includes, and wp-content directories)
 */
export function containsFullWordPressInstallation(path: string): boolean {
  const files = readdirSync(path);
  return (
    files.includes('wp-admin') &&
    files.includes('wp-includes') &&
    files.includes('wp-content')
  );
}

/**
 * Check if directory contains wp-content subdirectories
 * (themes, plugins, mu-plugins, or uploads)
 */
export function containsWpContentDirectories(path: string): boolean {
  const files = readdirSync(path);
  return (
    files.includes('themes') ||
    files.includes('plugins') ||
    files.includes('mu-plugins') ||
    files.includes('uploads')
  );
}

/**
 * Check if directory is a WordPress theme
 * (contains style.css with Theme Name header)
 */
export function isThemeDirectory(path: string): boolean {
  const files = readdirSync(path);
  if (!files.includes('style.css')) {
    return false;
  }
  const styleCssContent = readFileSync(join(path, 'style.css'), 'utf8');
  const themeNameRegex = /^(?:[ \t]*<\?php)?[ \t/*#@]*Theme Name:(.*)$/im;
  return !!themeNameRegex.exec(styleCssContent);
}

/**
 * Check if directory is a WordPress plugin
 * (contains PHP file with Plugin Name header)
 */
export function isPluginFilename(path: string): boolean {
  const files = readdirSync(path);
  const pluginNameRegex = /^(?:[ \t]*<\?php)?[ \t/*#@]*Plugin Name:(.*)$/im;
  const pluginNameMatch = files
    .filter((file) => file.endsWith('.php'))
    .find((file) => {
      const fileContent = readFileSync(join(path, file), 'utf8');
      return !!pluginNameRegex.exec(fileContent);
    });
  return !!pluginNameMatch;
}

/**
 * Detect WordPress project type based on directory contents
 * Priority order matches WordPress Playground CLI logic
 */
export function detectProjectType(path: string): ProjectType {
  if (isPluginFilename(path)) return 'plugin';
  if (isThemeDirectory(path)) return 'theme';
  if (containsWpContentDirectories(path)) return 'wp-content';
  if (containsFullWordPressInstallation(path)) return 'wordpress';
  return 'other';
}

import { describe, it, expect } from 'vitest';
import { validatePath } from '../../src/options/project-root';
import * as path from 'path';

describe('validatePath', () => {
  it('should allow empty string (will use cwd)', () => {
    expect(validatePath('')).toBeUndefined();
  });

  it('should allow whitespace-only string (will use cwd)', () => {
    expect(validatePath('   ')).toBeUndefined();
  });

  it('should return error for non-existent directory', () => {
    const result = validatePath('/this/path/does/not/exist/hopefully');
    expect(result).toBe('Directory does not exist');
  });

  it('should return undefined for valid absolute path', () => {
    // Use the current directory as a valid path
    const result = validatePath(process.cwd());
    expect(result).toBeUndefined();
  });

  it('should return undefined for valid relative path', () => {
    // Current directory should exist
    const result = validatePath('.');
    expect(result).toBeUndefined();
  });

  it('should handle relative paths correctly', () => {
    // Parent directory should exist in most cases
    const result = validatePath('..');
    expect(result).toBeUndefined();
  });

  it('should validate absolute paths without resolving', () => {
    const absolutePath = path.resolve(process.cwd());
    const result = validatePath(absolutePath);
    expect(result).toBeUndefined();
  });
});

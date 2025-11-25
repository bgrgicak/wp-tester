export * from './run.js';
import { runOption } from './run.js';
import type { ConfigOption } from '../types.js';

export const configOptions: ConfigOption[] = [
  runOption
];

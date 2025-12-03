import type { WPTesterConfig } from '../types.js';
import { runBuiltinTests } from './built-in-tests.js';

export type ConfigOption = (config: Partial<WPTesterConfig>) => Promise<Partial<WPTesterConfig>>;

export const setupOptions: ConfigOption[] = [
  runBuiltinTests
];

export const optionNames = [
  'built-in-tests'
] as const;

export type OptionName = typeof optionNames[number];

export const optionMap: Record<OptionName, ConfigOption> = {
  'built-in-tests': runBuiltinTests
};

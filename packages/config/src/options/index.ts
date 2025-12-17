import type { WPTesterConfig } from '../types';
import { rootDirOption } from './root-dir';
import { smokeTestsOption } from './smoke-tests';
import { phpunitOption } from './phpunit';

export type ConfigOption = (config: WPTesterConfig) => Promise<WPTesterConfig>;

export const optionMap = {
  'root-dir': rootDirOption,
  'smoke-tests': smokeTestsOption,
  'phpunit': phpunitOption
} as const;

export type OptionName = keyof typeof optionMap;

export const optionNames = Object.keys(optionMap) as OptionName[];

export const setupOptions = Object.values(optionMap);

import type { WPTesterConfig } from '../types';
import { projectRootOption } from './project-root';
import { projectTypeOption } from './project-type';
import { smokeTestsOption } from './smoke-tests';
import { phpunitOption } from './phpunit';

export type ConfigOption = (config: WPTesterConfig) => Promise<WPTesterConfig>;

export const optionMap = {
  'project-root': projectRootOption,
  'project-type': projectTypeOption,
  'smoke-tests': smokeTestsOption,
  'phpunit': phpunitOption
} as const;

export type OptionName = keyof typeof optionMap;

export const optionNames = Object.keys(optionMap) as OptionName[];

export const setupOptions = Object.values(optionMap);

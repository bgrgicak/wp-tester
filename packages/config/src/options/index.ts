import type { WPTesterConfig } from '../types';
import { projectRootOption } from './project-root';
import { projectTypeOption } from './project-type';
import { smokeTestsOption } from './smoke-tests';
import { phpunitOption } from './phpunit';
import { ciOption } from './ci';

export interface ConfigOptionContext {
  configPath?: string;
  [key: string]: unknown;
}

export type ConfigOption = (config: WPTesterConfig, context?: ConfigOptionContext) => Promise<WPTesterConfig>;

export interface ConfigOptionDefinition {
  handler: ConfigOption;
  getContext?: (configPath: string) => ConfigOptionContext;
}

const optionMapInternal = {
  'project-root': {
    handler: projectRootOption,
  },
  'project-type': {
    handler: projectTypeOption,
  },
  'smoke-tests': {
    handler: smokeTestsOption,
  },
  'phpunit': {
    handler: phpunitOption,
    getContext: (configPath: string) => ({ promptIfNotDetected: true, configPath }),
  },
  'ci': {
    handler: ciOption,
    getContext: (configPath: string) => ({ configPath }),
  }
} satisfies Record<string, ConfigOptionDefinition>;

export const optionMap: Record<string, ConfigOptionDefinition> = optionMapInternal;

export type OptionName = keyof typeof optionMapInternal;

export const optionNames = Object.keys(optionMapInternal) as Array<OptionName>;

export const setupOptions = Object.values(optionMap).map(opt => opt.handler);

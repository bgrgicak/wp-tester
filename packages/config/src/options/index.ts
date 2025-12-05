import type { WPTesterConfig } from '../types';
import { smokeTestsOption } from './smoke-tests';

export type ConfigOption = (config: Partial<WPTesterConfig>) => Promise<Partial<WPTesterConfig>>;

export const setupOptions: ConfigOption[] = [
  smokeTestsOption
];

export const optionNames = [
  'smoke-tests'
] as const;

export type OptionName = typeof optionNames[number];

export const optionMap: Record<OptionName, ConfigOption> = {
  'smoke-tests': smokeTestsOption
};

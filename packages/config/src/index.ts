// Types
export type {
  WPTesterConfig,
  Environment,
  Tests,
  Reporter,
  Mount,
  Blueprint,
  JsonReporterOptions,
} from './types';

// Functions
export {
  readConfigFile,
  writeConfigFile,
  configPath,
  getSchemaPath,
  getDefaultConfig,
  isConfigWritable,
} from './config';

// Options
export { optionNames, optionMap, setupOptions, type OptionName, type ConfigOption } from './options/index';
export { smokeTestsOption } from './options/smoke-tests';
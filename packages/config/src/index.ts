// Types
export type {
  WPTesterConfig,
  Environment,
  Tests,
  TestType,
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
  resolveConfig,
  getProjectDir,
  getConfigDir,
  getConfigPath,
} from './config';

// Options
export { optionNames, optionMap, setupOptions, type OptionName, type ConfigOption } from './options/index';
export { smokeTestsOption } from './options/smoke-tests';
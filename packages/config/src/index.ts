// Types
export type {
  WPTesterConfig,
  Environment,
  Tests,
  PHPUnitConfig,
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

export { getProjectRootMount } from './auto-mount';
export type { ProjectType } from './options/project-type-detect';

// Options
export { optionNames, optionMap, setupOptions, type OptionName, type ConfigOption } from './options/index';
export { smokeTestsOption } from './options/smoke-tests';
export { findPhpUnitConfig, parseBootstrapPath } from './options/phpunit-detect';
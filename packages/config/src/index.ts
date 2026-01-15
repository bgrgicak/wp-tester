// Types
export type {
  WPTesterConfig,
  EnvironmentVariables,
  Environment,
  Tests,
  PHPUnitConfig,
  TestType,
  Reporter,
  Mount,
  Blueprint,
  JsonReporterOptions,
  WatchConfig,
} from "./types";

// Resolved types (after resolveConfig())
export type {
  ResolvedEnvironment,
  ResolvedWPTesterConfig,
  ResolvedPHPUnitConfig,
  ResolvedTests,
  ResolvedBlueprint,
} from './resolved-types';

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
  normalizeConfigPath,
  resolveAbsolute,
  getWorkingDirectory,
} from "./config";

export { getProjectRootMount } from './auto-mount';
export { hostToVfs, vfsToHost } from './path-mappers';
export type { ProjectType } from './options/project-type-detect';

// Options
export { optionNames, optionMap, setupOptions, type OptionName, type ConfigOption, type ConfigOptionContext } from './options/index';
export { smokeTestsOption } from './options/smoke-tests';
export { phpunitOption } from './options/phpunit';
export { findPhpUnitConfig, findPhpUnitExecutable, findPhpUnitBootstrap, parseBootstrapPath, detectPhpUnitConfig, type DetectedPHPUnitConfig } from './options/phpunit-detect';
import { readFile } from 'fs/promises';
import Ajv, { type ErrorObject } from "ajv";
import pc from "picocolors";
import { getSchemaPath, normalizeConfigPath, type WPTesterConfig } from "@wp-tester/config";
import * as clack from "../../cli/theme";

interface ValidationErrorDisplay {
  message: string;
  hint: string;
  docsUrl: string;
}

/**
 * Known top-level configuration properties that have their own documentation sections.
 * These correspond to the main headings in the configuration.md file.
 */
const DOCUMENTED_PROPERTIES = new Set(['environments', 'tests', 'reporters']);

/**
 * Get the documentation URL for a configuration property.
 * Returns a full URL pointing to the relevant documentation section.
 *
 * For nested properties (e.g., 'tests.wp'), we link to the parent section.
 * For unknown/unrecognized properties, pass 'unknown' to link to configuration options.
 */
function getDocumentationUrl(propertyName: string): string {
  const baseUrl = 'https://bgrgicak.github.io/wp-tester/#/configuration';

  if (!propertyName) {
    return baseUrl; // Link to top of page
  }

  // Check if this is a known top-level property with its own section
  if (DOCUMENTED_PROPERTIES.has(propertyName)) {
    return `${baseUrl}?id=${propertyName.toLowerCase()}`;
  }

  // For all other properties, link to the configuration options section
  return `${baseUrl}?id=configuration-options`;
}

/**
 * Format a validation error into a user-friendly message with documentation link
 */
export function formatValidationError(error: ErrorObject): ValidationErrorDisplay {
  const instancePath = error.instancePath || "/";

  switch (error.keyword) {
    case 'additionalProperties': {
      const unknownProp = error.params?.additionalProperty as string;
      return {
        message: `Unknown property: ${pc.bold(unknownProp)}`,
        hint: 'This property is not recognized. Check for typos in your property names.',
        docsUrl: getDocumentationUrl('unknown')
      };
    }

    case 'required': {
      const missingProp = error.params?.missingProperty as string;
      return {
        message: `Missing required property: ${pc.bold(missingProp)}`,
        hint: `The "${missingProp}" property is required in your configuration.`,
        docsUrl: getDocumentationUrl(missingProp)
      };
    }

    case 'enum': {
      const allowedValues = (error.params?.allowedValues as string[]) || [];
      // Extract the root property from the path
      const rootProperty = instancePath.split('/')[1] || '';
      return {
        message: `Invalid value at ${pc.bold(instancePath)}`,
        hint: `Allowed values: ${allowedValues.map(v => pc.cyan(v)).join(', ')}`,
        docsUrl: getDocumentationUrl(rootProperty)
      };
    }

    case 'type': {
      const expectedType = error.params?.type as string;
      // Extract the root property from the path (e.g., /tests/wp -> tests)
      const rootProperty = instancePath.split('/')[1] || '';
      return {
        message: `Type error at ${pc.bold(instancePath)}`,
        hint: `Expected type: ${pc.cyan(expectedType)}`,
        docsUrl: getDocumentationUrl(rootProperty)
      };
    }

    case 'minItems': {
      const limit = error.params?.limit as number;
      // Extract the root property from the path
      const rootProperty = instancePath.split('/')[1] || '';
      return {
        message: `Array at ${pc.bold(instancePath)} is too short`,
        hint: `Minimum items required: ${pc.cyan(String(limit))}`,
        docsUrl: getDocumentationUrl(rootProperty)
      };
    }

    default: {
      return {
        message: `${instancePath}: ${error.message || 'validation error'}`,
        hint: error.params ? JSON.stringify(error.params) : '',
        docsUrl: getDocumentationUrl('')
      };
    }
  }
}

/**
 * Validates config and prints errors if invalid.
 * Returns true if valid, false otherwise.
 */
export async function validateConfig(configPath: string): Promise<boolean> {
  try {
    // Resolve config path relative to cwd and normalize (handles directory paths)
    const resolvedConfigPath = normalizeConfigPath(configPath);

    const config = JSON.parse(await readFile(resolvedConfigPath, "utf-8")) as unknown;
    // Get schema path from config package
    const schemaPath = getSchemaPath();
    const schema = JSON.parse(await readFile(schemaPath, "utf-8")) as object;

    // Validate using Ajv
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(schema);
    const valid = validate(config);

    if (!valid) {
      if (validate.errors) {
        // Group errors by documentation URL to show one link per error type
        const errorsByUrl = new Map<string, ValidationErrorDisplay[]>();

        for (const error of validate.errors) {
          const formatted = formatValidationError(error);
          const existing = errorsByUrl.get(formatted.docsUrl) || [];
          existing.push(formatted);
          errorsByUrl.set(formatted.docsUrl, existing);
        }

        // Display all errors with their hints
        for (const [_, errors] of errorsByUrl) {
          for (const error of errors) {
            clack.log.error(`Configuration validation failed: ${error.message}`);
            if (error.hint) {
              clack.log.info(pc.dim(error.hint));
            }
          }
        }

        // Show documentation links (unique URLs only)
        if (errorsByUrl.size > 0) {
          const urls = Array.from(errorsByUrl.keys());
          clack.log.info(pc.dim(`Learn more: ${urls.join(', ')}`));
        }
      }

      return false;
    }

    // Check for skipped environments and display info
    const typedConfig = config as WPTesterConfig;
    if (typedConfig.environments) {
      const skippedEnvs = typedConfig.environments.filter(env => env.skip === true);
      if (skippedEnvs.length > 0) {
        for (const env of skippedEnvs) {
          const envName = env.name || 'Unnamed environment';
          clack.log.warn(pc.yellow(` ${envName} (Skipped)`));
        }
      }
    }

    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    clack.log.error("Validation error:");
    clack.log.error(message);
    return false;
  }
}
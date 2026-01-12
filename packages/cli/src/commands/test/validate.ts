import { readFile, access, constants } from "fs/promises";
import path from "path";
import Ajv, { ErrorObject } from "ajv";
import pc from "picocolors";
import { getSchemaPath } from "@wp-tester/config";
import * as clack from "../../cli/theme";

interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

interface SuggestionMap {
  [key: string]: string;
}

/**
 * Maps common validation error paths to actionable suggestions
 */
function getSuggestion(error: ErrorObject): string | undefined {
  const suggestions: SuggestionMap = {
    "/environments": "The 'environments' array is required. Add at least one environment with a blueprint configuration.",
    "/tests": "The 'tests' object is required. Specify which tests to run (wp, plugin, theme, or phpunit).",
  };

  // Check for specific error path suggestions
  if (error.instancePath && suggestions[error.instancePath]) {
    return suggestions[error.instancePath];
  }

  // Provide contextual suggestions based on error type and keyword
  if (error.keyword === "required") {
    const missingProp = error.params?.missingProperty;
    if (missingProp === "environments") {
      return "Add an 'environments' array with at least one environment configuration. Example:\n" +
        '  "environments": [{ "blueprint": { "preferredVersions": { "php": "latest", "wp": "latest" } } }]';
    }
    if (missingProp === "tests") {
      return "Add a 'tests' object to specify which tests to run. Example:\n" +
        '  "tests": { "wp": true }';
    }
    if (missingProp === "blueprint") {
      return "Each environment requires a 'blueprint' configuration. Example:\n" +
        '  "blueprint": { "preferredVersions": { "php": "latest", "wp": "latest" }, "login": true }';
    }
    if (missingProp === "hostPath") {
      return "Each mount requires a 'hostPath' specifying the local filesystem path.";
    }
    if (missingProp === "vfsPath") {
      return "Each mount requires a 'vfsPath' specifying the virtual filesystem path in WordPress Playground.";
    }
    if (missingProp === "phpunitPath") {
      return "PHPUnit configuration requires 'phpunitPath'. Example: \"vendor/bin/phpunit\"";
    }
    if (missingProp === "configPath") {
      return "PHPUnit configuration requires 'configPath'. Example: \"phpunit.xml\" or \"phpunit.xml.dist\"";
    }
    if (missingProp === "outputFile") {
      return "JSON reporter requires 'outputFile'. Example: \"test-results.json\"";
    }
  }

  if (error.keyword === "type") {
    const expectedType = error.params?.type;
    if (error.instancePath.includes("/environments")) {
      return `Expected ${expectedType}. Environments must be an array of environment objects.`;
    }
    return `Expected ${expectedType}. Check the value type at this path.`;
  }

  if (error.keyword === "enum") {
    const allowedValues = error.params?.allowedValues;
    if (allowedValues) {
      return `Allowed values: ${allowedValues.join(", ")}`;
    }
  }

  if (error.keyword === "additionalProperties") {
    const extraProp = error.params?.additionalProperty;
    return `Unknown property '${extraProp}'. Check for typos or remove this property.`;
  }

  if (error.keyword === "minItems") {
    if (error.instancePath === "/environments") {
      return "At least one environment is required. Add an environment configuration.";
    }
  }

  return undefined;
}

/**
 * Formats a validation error into a user-friendly message with suggestion
 */
function formatError(error: ErrorObject): string {
  const instancePath = error.instancePath || "(root)";
  const message = error.message || "unknown error";
  const suggestion = getSuggestion(error);

  let formatted = `${pc.red("✗")} ${pc.bold(instancePath)}: ${message}`;

  if (suggestion) {
    formatted += `\n  ${pc.cyan("→")} ${pc.dim(suggestion)}`;
  }

  return formatted;
}

/**
 * Validates the configuration file before running tests.
 * Returns validation result with errors if invalid.
 */
export async function validateConfigFile(
  configPath: string
): Promise<ValidationResult> {
  const errors: string[] = [];

  try {
    // Check if file exists
    try {
      await access(configPath, constants.F_OK);
    } catch {
      errors.push(
        `${pc.red("✗")} Config file not found: ${configPath}\n` +
          `  ${pc.cyan("→")} ${pc.dim("Run 'wp-tester setup' to create a configuration file, or specify the correct path with --config")}`
      );
      return { valid: false, errors };
    }

    // Read and parse config file
    let config: unknown;
    try {
      const content = await readFile(configPath, "utf-8");
      config = JSON.parse(content);
    } catch (parseError) {
      const message =
        parseError instanceof Error ? parseError.message : "Unknown parse error";
      errors.push(
        `${pc.red("✗")} Invalid JSON in config file: ${message}\n` +
          `  ${pc.cyan("→")} ${pc.dim("Check for syntax errors like missing commas, brackets, or quotes")}`
      );
      return { valid: false, errors };
    }

    // Load and validate against schema
    const schemaPath = getSchemaPath();
    const schema = JSON.parse(await readFile(schemaPath, "utf-8")) as object;

    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(schema);
    const valid = validate(config);

    if (!valid && validate.errors) {
      for (const error of validate.errors) {
        errors.push(formatError(error));
      }
      return { valid: false, errors };
    }

    return { valid: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    errors.push(
      `${pc.red("✗")} Validation error: ${message}\n` +
        `  ${pc.cyan("→")} ${pc.dim("Check that your config file is valid and accessible")}`
    );
    return { valid: false, errors };
  }
}

/**
 * Validates config and prints errors if invalid.
 * Returns true if valid, false otherwise.
 */
export async function validateConfig(configPath: string): Promise<boolean> {
  const result = await validateConfigFile(configPath);

  if (!result.valid && result.errors) {
    clack.log.error(pc.bold("Configuration validation failed:"));
    console.error("");

    for (const error of result.errors) {
      console.error(`  ${error}`);
      console.error("");
    }

    console.error(
      pc.dim("  Tip: Run 'wp-tester config validate' for detailed validation.")
    );
    console.error("");

    return false;
  }

  return true;
}

import { readFile } from 'fs/promises';
import path from 'path';
import Ajv from "ajv";
import pc from "picocolors";
import { getSchemaPath } from "@wp-tester/config";

/**
 * Validates config and prints errors if invalid.
 * Returns true if valid, false otherwise.
 */
export async function validateConfig(configPath: string): Promise<boolean> {
  try {
    // Resolve config path relative to cwd
    const resolvedConfigPath = path.resolve(process.cwd(), configPath);

    const config = JSON.parse(await readFile(resolvedConfigPath, "utf-8")) as unknown;
    // Get schema path from config package
    const schemaPath = getSchemaPath();
    const schema = JSON.parse(await readFile(schemaPath, "utf-8")) as object;

    // Validate using Ajv
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(schema);
    const valid = validate(config);

    if (!valid) {
      console.error(pc.red(pc.bold("Configuration validation failed:")));
      console.error("");

      if (validate.errors) {
        for (const error of validate.errors) {
          const instancePath = error.instancePath || "/";
          const message = error.message || "unknown error";
          console.error(pc.red(`  ${instancePath}: ${message}`));

          if (error.params && Object.keys(error.params).length > 0) {
            console.error(pc.dim(`    ${JSON.stringify(error.params)}`));
          }
        }
      }

      console.error("");
      return false;
    }

    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(pc.red(pc.bold("Validation error:")));
    console.error(pc.red(`  ${message}`));
    console.error("");
    return false;
  }
}

/**
 * CLI handler for the validate command.
 * Validates config and exits with appropriate code.
 */
export async function validateConfigCommand(configPath: string): Promise<void> {
  const isValid = await validateConfig(configPath);
  if (!isValid) {
    process.exit(1);
  }
  console.log(pc.green(pc.bold("✓ Configuration is valid")));
}

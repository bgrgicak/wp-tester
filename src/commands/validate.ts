import { readFile } from 'fs/promises';
import path from 'path';
import Ajv from "ajv";
import pc from "picocolors";
import { getCurrentDir } from "../utils/paths.js";

export async function validateConfig(configPath: string): Promise<void> {
  try {
    // Resolve config path relative to cwd
    const resolvedConfigPath = path.resolve(process.cwd(), configPath);

    const config = JSON.parse(await readFile(resolvedConfigPath, "utf-8"));
    // @ts-ignore - import.meta is only available in ESM, handled by getCurrentDir
    const currentDir = getCurrentDir(typeof import.meta !== 'undefined' ? import.meta.url : undefined);
    const schemaPath = path.resolve(
      currentDir,
      "../config/schema.json"
    );
    const schema = JSON.parse(await readFile(schemaPath, "utf-8"));

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
      process.exit(1);
    }

    console.log(pc.green(pc.bold("✓ Configuration is valid")));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(pc.red(pc.bold("Validation error:")));
    console.error(pc.red(`  ${message}`));
    console.error("");
    process.exit(1);
  }
}

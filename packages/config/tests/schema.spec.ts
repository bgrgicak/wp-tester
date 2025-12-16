import { describe, it, expect } from 'vitest';
import { getSchemaPath } from "../src/index";
import { existsSync, readFileSync } from 'fs';

describe("Schema", () => {
  it("getSchemaPath returns a path to an existing schema file", () => {
    const schemaPath = getSchemaPath();
    expect(existsSync(schemaPath)).toBe(true);

    // Verify it's actually a valid JSON schema
    const schemaContent = readFileSync(schemaPath, "utf-8");
    const schema = JSON.parse(schemaContent);
    expect(schema).toHaveProperty("$schema");
    expect(schema).toHaveProperty("type");
    expect(schema.type).toBe("object");
  });
});

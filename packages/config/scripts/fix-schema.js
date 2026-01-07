import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read the generated schema from src
const srcSchemaPath = path.join(__dirname, '..', 'src', 'schema.json');
const schema = JSON.parse(fs.readFileSync(srcSchemaPath, 'utf8'));

// Remove any empty string keys (corruption from typescript-json-schema)
delete schema[''];
if (schema.properties) {
  delete schema.properties[''];
}

// Add proper $schema and $id at root level
schema.$schema = 'http://json-schema.org/draft-07/schema#';
schema.$id = 'https://raw.githubusercontent.com/bgrgicak/wp-tester/trunk/packages/config/src/schema.json';

// Allow $schema property in config files
if (schema.properties) {
  schema.properties.$schema = {
    type: 'string',
    description: 'JSON Schema reference for IDE validation and autocomplete'
  };
}

// Add conditional requirement: if projectType is "other", then projectVFSPath is required
// This ensures that when projectType is explicitly set to "other", the user must provide a VFS path
schema.allOf = [
  {
    if: {
      properties: {
        projectType: {
          const: 'other'
        }
      },
      required: ['projectType']
    },
    then: {
      required: ['projectVFSPath']
    }
  }
];

// Write back the fixed schema to src
fs.writeFileSync(srcSchemaPath, JSON.stringify(schema, null, 2));

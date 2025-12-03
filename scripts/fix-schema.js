import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read the generated schema from src/config
const srcSchemaPath = path.join(__dirname, '..', 'src', 'config', 'schema.json');
const schema = JSON.parse(fs.readFileSync(srcSchemaPath, 'utf8'));

// Remove any empty string keys (corruption from typescript-json-schema)
delete schema[''];
if (schema.properties) {
  delete schema.properties[''];
}

// Add proper $schema and $id at root level
schema.$schema = 'http://json-schema.org/draft-07/schema#';
schema.$id = 'https://raw.githubusercontent.com/bgrgicak/wp-tester/trunk/public/schema.json';

// Allow $schema property in config files
if (schema.properties) {
  schema.properties.$schema = {
    type: 'string',
    description: 'JSON Schema reference for IDE validation and autocomplete'
  };
}

// Write back the fixed schema to src/config
fs.writeFileSync(srcSchemaPath, JSON.stringify(schema, null, 2));

// Ensure public directory exists
const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

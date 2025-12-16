import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const TEST_THEME_PATH = join(__dirname, "../fixtures/wp-tester-theme");

export const TEST_PLUGIN_PATH = join(__dirname, "../fixtures/wp-tester-plugin");

import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const TEST_THEME_PATH: string = join(__dirname, "../fixtures/wp-tester-theme");
export const TEST_THEME_CONFIG_PATH: string = join(TEST_THEME_PATH, "wp-tester.json");

export const TEST_PLUGIN_PATH: string = join(__dirname, "../fixtures/wp-tester-plugin");
export const TEST_PLUGIN_CONFIG_PATH: string = join(TEST_PLUGIN_PATH, "wp-tester.json");

import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  globalIgnores(["lib", "coverage", "metadata.json", "compat.json"]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: { globals: globals.node },
  },
  {
    files: ["test/**"],
    languageOptions: { globals: globals.jest },
  },
  prettier
);

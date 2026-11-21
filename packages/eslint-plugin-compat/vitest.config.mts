import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "benchmarks-tmp/**"],
    setupFiles: ["test/setup.ts"],
  },
});

import { defineConfig } from "vitest/config";

export default defineConfig({
  server: {
    host: true,
  },
  test: {
    coverage: {
      enabled: true,
      include: ["**/*.ts"],
      reporter: ["json"],
    },
  },
});

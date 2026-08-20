import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.integration.test.ts"],
    environment: "node",
    globals: true,
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});

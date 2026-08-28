import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/electron",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 60_000,
});

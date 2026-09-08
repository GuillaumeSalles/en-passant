import { defineConfig, devices } from "@playwright/test";
const port = process.env.E2E_PORT ?? "8082";
export default defineConfig({
  testDir: "./apps/native/tests/e2e",
  outputDir: "./apps/native/test-results",
  fullyParallel: true,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: { baseURL: `http://localhost:${port}`, trace: "retain-on-failure" },
  webServer: {
    command: `node scripts/serve-native-preview.mjs ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
  },
  projects: [
    { name: "native-phone", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
    {
      name: "native-tablet",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1024, height: 768 } },
    },
  ],
});

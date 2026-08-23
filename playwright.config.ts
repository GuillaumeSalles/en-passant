import { defineConfig, devices } from "@playwright/test";

const e2ePort = process.env.E2E_PORT ?? "5174";
const e2eBaseUrl = `http://localhost:${e2ePort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: process.env.CI ? undefined : 1,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: e2eBaseUrl,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npm run dev:vite -- --host localhost --port ${e2ePort} --strictPort --force`,
    url: e2eBaseUrl,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

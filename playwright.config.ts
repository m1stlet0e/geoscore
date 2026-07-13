import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? "18200");
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
    { name: "mobile", use: { ...devices["Pixel 5"], channel: "chrome" } },
  ],
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: baseURL,
    env: {
      BETTER_AUTH_URL: baseURL,
      AI_PROVIDER: "mock",
      PAYMENT_PROVIDER: "mock",
      SMS_PROVIDER: "mock",
      SMS_TEST_CODE: "888888",
    },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

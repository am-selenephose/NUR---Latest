import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.NUR_REAL_STACK_BASE_URL?.trim();
if (!baseURL) throw new Error("NUR_REAL_STACK_BASE_URL is required for real-stack Playwright proofs.");
const reportDir = process.env.NUR_REAL_STACK_REPORT_DIR ?? "playwright-report-real-stack";
const outputDir = process.env.NUR_REAL_STACK_OUTPUT_DIR ?? "test-results-real-stack";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: reportDir }],
  ],
  outputDir,
  use: {
    baseURL,
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "chromium-mobile", use: { ...devices["Pixel 5"] } },
    { name: "webkit-desktop", use: { ...devices["Desktop Safari"] } },
    { name: "webkit-mobile", use: { ...devices["iPhone 13"] } },
  ],
});

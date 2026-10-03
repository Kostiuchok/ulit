import { defineConfig, devices } from "@playwright/test";

// Sprint 3 E2E hits a deployed environment (prod by default). It does not
// boot the local Next.js dev server — that server is only for the smoke
// suite in playwright.config.ts.
const baseURL = process.env.BASE_URL || process.env.E2E_BASE_URL || "https://ulit.render.ua";

export default defineConfig({
  testDir: "./e2e/sprint3",
  timeout: 360_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "uk-UA",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

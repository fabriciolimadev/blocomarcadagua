import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    acceptDownloads: true,
    navigationTimeout: 60_000,
  },
  projects: [
    { name: "desktop", grepInvert: /tablet layout/, use: { viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", grepInvert: /tablet layout/, use: { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } },
    { name: "tablet", grep: /tablet layout/, use: { viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: "reduce" } },
  ],
});

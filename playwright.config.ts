import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Every test signs in as the same shared admin account (that's the whole
  // point of "single shared admin account, no public sign-up"). Supabase's
  // refresh-token rotation invalidates a session when another sign-in
  // rotates the same account's token concurrently, so tests must run
  // one at a time rather than racing each other.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  // Local Supabase's first request after the dev/prod server or the Kong
  // gateway container just started occasionally hits a stale keep-alive
  // socket and fails once; it succeeds every time on retry. One retry
  // locally absorbs that without masking a real, repeatable failure.
  retries: process.env.CI ? 2 : 1,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});

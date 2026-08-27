import { chromium } from "playwright";
import { TEST_ADMIN_USERNAME, TEST_ADMIN_PASSWORD } from "./test-credentials";

// One-off / rerun-when-the-UI-changes tool for the landing page's product
// screenshots (public/screenshots/*.png) -- not part of the app itself.
// Points at whatever dev server is already running on :3000 rather than
// starting its own, so it picks up local seed data (npm run db:seed +
// npm run db:seed:expenses) instead of an empty database.
const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";

const PAGES: { path: string; file: string }[] = [
  { path: "/transport", file: "public/screenshots/transport.png" },
  { path: "/students", file: "public/screenshots/students.png" },
  { path: "/expenses", file: "public/screenshots/expenses.png" },
];

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel("Username").fill(TEST_ADMIN_USERNAME);
  await page.getByLabel("Password").fill(TEST_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(`${BASE_URL}/transport`);

  for (const { path, file } of PAGES) {
    await page.goto(`${BASE_URL}${path}`);
    // Real network+DB fetch, not a fixed sleep -- waits for the actual
    // content to replace the skeleton loading state.
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: file });
    console.log(`Saved ${file}`);
  }

  await browser.close();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

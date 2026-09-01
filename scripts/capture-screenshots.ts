// Captures the landing page's product screenshots directly to
// public/screenshots/ via Playwright's own screenshot API -- the one
// reliable way to get a real image file onto disk from this tooling (see
// README's "Screenshots" section, which this replaces the manual-capture
// caveat in).
//
// Run against a freshly seeded local Supabase (npm run db:reset && npm run
// db:seed && npm run auth:seed) and a running app server, then:
//
//   npm run screenshots
//
// A production build (npm run build && npm run start) is deliberately
// what these should be captured against, not `npm run dev` -- the dev
// server renders its own floating dev-mode indicator badge over the page,
// which has no business showing up in a screenshot of the product.
//
// Never run against a real/production database -- these are seeded fake
// students end to end, and CLAUDE.md's PII rule means real student data
// must never end up in a checked-in screenshot.
import { chromium } from "@playwright/test";
import {
  TEST_ADMIN_USERNAME,
  TEST_ADMIN_PASSWORD,
} from "./test-credentials";

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";

interface Shot {
  name: string;
  path: string;
  // Waits for this text to appear before capturing -- the dashboards
  // stream in via Suspense, so a fixed delay would be a race either way.
  waitForText: string;
}

const SHOTS: Shot[] = [
  { name: "transport", path: "/transport", waitForText: "By branch" },
  { name: "students", path: "/students", waitForText: "Date added" },
  { name: "expenses", path: "/expenses", waitForText: "By category" },
  { name: "logs", path: "/logs", waitForText: "Activity log" },
];

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel("Username").fill(TEST_ADMIN_USERNAME);
  await page.getByLabel("Password").fill(TEST_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/transport$/);

  for (const shot of SHOTS) {
    await page.goto(`${BASE_URL}${shot.path}`);
    await page.getByText(shot.waitForText).first().waitFor();
    // Let any entrance/reveal animation settle so the capture isn't
    // mid-fade.
    await page.waitForTimeout(400);
    const path = `public/screenshots/${shot.name}.png`;
    await page.screenshot({ path });
    console.log(`Captured ${path}`);
  }

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

// Writes public/brand/ek-desk-logo.png (and a version on the cream
// background): the mark and the "EK Desk" wordmark exactly as the site
// draws them, at 8x so it is sharp at any size a document or slide needs.
//
// A screenshot of the real component rather than a hand-built SVG, because
// the wordmark is live text in Hanken Grotesk: an SVG <text> would fall
// back to whatever font the viewer happens to have. The mark on its own is
// plain shapes, so it does have an SVG: public/brand/ek-desk-mark.svg.
//
//   npm run dev   (in another terminal)
//   npx tsx scripts/export-logo.ts
import { chromium } from "@playwright/test";

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 8,
  });
  await page.goto(`${BASE_URL}/login`);
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
  await page.evaluate(() => document.fonts.ready);
  const logo = page.getByRole("link", { name: "EK Desk home" });
  await logo.waitFor();

  await logo.screenshot({ path: "public/brand/ek-desk-logo-on-cream.png" });

  // Same element with every background cleared, for a transparent PNG.
  await page.addStyleTag({
    content: "html, body, main, main * { background: transparent !important; }",
  });
  await logo.screenshot({
    path: "public/brand/ek-desk-logo.png",
    omitBackground: true,
  });

  await browser.close();
  console.log(
    "Wrote public/brand/ek-desk-logo.png and ek-desk-logo-on-cream.png",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

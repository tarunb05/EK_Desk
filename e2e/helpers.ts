import type { Locator, Page } from "@playwright/test";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Replaces `.getByLabel(label).fill("YYYY-MM-DD")`, which worked against
// the native <input type="date"> every date field used to be. They're now
// a trigger button that opens components/ui/calendar.tsx's popover -- no
// element to fill, so this opens it, picks the target year and month from
// the calendar's own Year/Month dropdowns, then clicks the day by the
// full-date aria-label the calendar puts on every day button (e.g. "June
// 1, 2026") -- also what disambiguates it from any same-numbered
// outside-month day sharing the grid.
export async function pickDate(
  scope: Page | Locator,
  label: string,
  isoDate: string,
): Promise<void> {
  const [year, month, day] = isoDate.split("-").map(Number);

  await scope.getByLabel(label).click();

  const page = "page" in scope ? scope.page() : (scope as Page);
  await page.getByRole("combobox", { name: "Year", exact: true }).click();
  await page.getByRole("option", { name: String(year), exact: true }).click();
  await page.getByRole("combobox", { name: "Month", exact: true }).click();
  await page
    .getByRole("option", { name: MONTHS[month! - 1], exact: true })
    .click();

  await page
    .getByRole("button", {
      name: `${MONTHS[month! - 1]} ${day}, ${year}`,
      exact: true,
    })
    .click();
}

// A ServiceScopeDashboard route (/transport, /daycare) renders
// loading.tsx's shimmering skeleton (page-skeletons.tsx) while the Server
// Component's data is still in flight, then swaps to the real content --
// page.goto() only waits for navigation, not for that swap, so reading
// main's innerText() right after goto() can race the skeleton and capture
// "Loading…" instead of the real dashboard (the failure this fixes: a
// baseline snapshot taken too early, compared later against real content).
// The "students-enrolled" stat card only exists in the real content, never
// the skeleton, so waiting for it is a reliable "done loading" signal.
export async function waitForDashboardLoaded(page: Page): Promise<void> {
  await page.getByTestId("students-enrolled").waitFor();
}

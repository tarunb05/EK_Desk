import type { Locator, Page } from "@playwright/test";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Replaces `.getByLabel(label).fill("YYYY-MM-DD")`, which worked against
// the native <input type="date"> every date field used to be. They're now
// a trigger button that opens components/ui/calendar.tsx's popover -- no
// element to fill, so this opens it, reads the currently displayed
// "{Month} {Year}" header, clicks "Previous"/"Next month" the right number
// of times to reach the target month (the popover always opens on today's
// month for an empty field, which can be either side of the target), then
// clicks the day by the full-date aria-label the calendar puts on every
// day button (e.g. "June 1, 2026") -- also what disambiguates it from any
// same-numbered outside-month day sharing the grid.
export async function pickDate(
  scope: Page | Locator,
  label: string,
  isoDate: string,
): Promise<void> {
  const [year, month, day] = isoDate.split("-").map(Number);
  const targetIndex = year! * 12 + (month! - 1);

  await scope.getByLabel(label).click();

  const page = "page" in scope ? scope.page() : (scope as Page);
  const heading = page.getByTestId("calendar-month-year");

  for (let guard = 0; guard < 36; guard++) {
    const shown = (await heading.textContent())?.trim() ?? "";
    const match = /^(\w+) (\d+)$/.exec(shown);
    if (!match) break;
    const shownIndex =
      MONTHS.indexOf(match[1]!) + Number(match[2]) * 12;
    if (shownIndex === targetIndex) break;
    await page
      .getByRole("button", {
        name: shownIndex < targetIndex ? "Next month" : "Previous month",
      })
      .click();
  }

  await page
    .getByRole("button", { name: `${MONTHS[month! - 1]} ${day}, ${year}`, exact: true })
    .click();
}

import { expect, test } from "@playwright/test";
import {
  TEST_ADMIN_USERNAME,
  TEST_ADMIN_PASSWORD,
} from "../scripts/test-credentials";
import { pickDate } from "./helpers";

function parseRupees(text: string): number {
  return Number(text.replace(/[₹,]/g, ""));
}

async function readStat(page: import("@playwright/test").Page, testId: string) {
  return parseRupees(await page.getByTestId(testId).innerText());
}

test.describe("daycare spine", () => {
  test("add student with a slot, record payment, void it, and confirm transport is unaffected", async ({
    page,
  }) => {
    // Default 30s budget assumed every date field was one .fill() call;
    // the calendar popover replacing <input type="date"> makes each of
    // this test's 4 date fields a multi-click interaction (open, navigate
    // months, click the day) instead, which is slower by design, not a
    // stall -- give the whole real-work flow (add student, record
    // payment, void it, check two dashboards) proper headroom.
    test.setTimeout(60_000);

    await page.goto("/login");
    await page.getByLabel("Username").fill(TEST_ADMIN_USERNAME);
    await page.getByLabel("Password").fill(TEST_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/transport$/);

    await page.goto("/daycare?branch=BR-B");
    const baselineStudents = await readStat(page, "students-enrolled");
    const baselineReceivable = await readStat(page, "total-receivable");

    const baselineTransportText = await (async () => {
      await page.goto("/transport");
      return page.locator("main").innerText();
    })();

    // Add a student with a daycare fee account — the form must show a Slot
    // field, not the transport-only Route/Pickup point fields.
    await page.goto("/daycare/new");
    const form = page.locator("main");
    await expect(form.getByLabel("Route")).toHaveCount(0);
    await form.getByLabel("Branch").click();
    await page.getByRole("option", { name: "Kannuru" }).click();
    await form.getByLabel("Admission number").fill("BR-B-E2E-001");
    await form
      .getByLabel("Student full name")
      .fill("Playwright Daycare Student");
    await form.getByLabel("Guardian name").fill("Playwright Guardian");
    await form.getByLabel("Phone").fill("9000000456");
    await form.getByLabel("Grade").click();
    await page.getByRole("option", { name: "Euro Senior" }).click();
    await form.getByLabel("Slot").fill("Morning (8-1)");
    await form.getByLabel("Total receivable (₹)").fill("12000");
    await pickDate(form, "Due date", "2026-06-01");
    await pickDate(form, "Starts on", "2026-04-01");
    await pickDate(form, "Ends on", "2027-03-31");
    await form.getByRole("button", { name: "Add student" }).click();
    await expect(page).toHaveURL(/\/daycare$/);

    await page.goto("/daycare?branch=BR-B");
    expect(await readStat(page, "students-enrolled")).toBe(
      baselineStudents + 1,
    );
    expect(await readStat(page, "total-receivable")).toBe(
      baselineReceivable + 12_000,
    );

    // Record a part payment — found via the Students directory now that
    // the per-service dashboards no longer list students, just figures.
    await page.goto("/students?q=Playwright+Daycare");
    await page.getByRole("button", { name: "Actions" }).click();
    await page.getByRole("menuitem", { name: "Record payment" }).click();
    await page.getByLabel("Amount (₹)").fill("5000");
    await pickDate(page, "Paid on", "2026-05-01");
    await page.getByLabel("Recorded by").fill("front_office");
    await page.getByRole("button", { name: "Record payment" }).click();
    await expect(page).toHaveURL(/\/daycare$/);

    await page.goto("/daycare?branch=BR-B");
    const afterPaymentCollected = await readStat(page, "total-collected");
    const afterPaymentPending = await readStat(page, "total-pending");

    // Void via the student's detail page; the void link must stay within
    // /daycare (driven by the fee account's own service_type, regardless of
    // which prefix was used to view the page).
    await page.goto("/students?q=Playwright+Daycare");
    await page
      .getByRole("link", { name: "Playwright Daycare Student" })
      .click();
    const voidLink = page.getByRole("link", { name: "Void" });
    await expect(voidLink).toHaveAttribute("href", /^\/daycare\/payment\//);
    await voidLink.click();
    await page.getByLabel("Reason for voiding").fill("E2E spine test cleanup");
    await page.getByRole("button", { name: "Void payment" }).click();
    await expect(page).toHaveURL(/\/daycare$/);

    await page.goto("/daycare?branch=BR-B");
    expect(await readStat(page, "total-collected")).toBe(
      afterPaymentCollected - 5_000,
    );
    expect(await readStat(page, "total-pending")).toBe(
      afterPaymentPending + 5_000,
    );

    // Transport never changed.
    await page.goto("/transport");
    expect(await page.locator("main").innerText()).toBe(baselineTransportText);
  });
});

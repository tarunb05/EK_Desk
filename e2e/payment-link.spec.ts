import { expect, test } from "@playwright/test";
import {
  TEST_ADMIN_USERNAME,
  TEST_ADMIN_PASSWORD,
  TEST_TEACHERS,
} from "../scripts/test-credentials";
import { pickDate } from "./helpers";

test.describe("payment link", () => {
  test("admin creates a link for part of the pending amount, then cancels it", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    await page.goto("/login");
    await page.getByLabel("Username").fill(TEST_ADMIN_USERNAME);
    await page.getByLabel("Password").fill(TEST_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/transport$/);

    // A fresh student with a real pending balance -- the Payment link
    // button only renders for an account with pending_paise > 0.
    await page.goto("/transport/new");
    const addStudentForm = page.locator("main");
    await addStudentForm.getByLabel("Branch").click();
    await page.getByRole("option", { name: "Kothanur" }).click();
    await addStudentForm.getByLabel("Admission number").fill("BR-A-E2E-PLINK");
    await addStudentForm
      .getByLabel("Student full name")
      .fill("Playwright Payment Link Student");
    await addStudentForm.getByLabel("Guardian name").fill("Playwright Guardian");
    await addStudentForm.getByLabel("Phone").fill("9000000456");
    await addStudentForm.getByLabel("Grade").click();
    await page.getByRole("option", { name: "Nursery", exact: true }).click();
    await addStudentForm.getByLabel("Pickup point").fill("Main Gate");
    await addStudentForm.getByLabel("Total receivable (₹)").fill("10000");
    await pickDate(addStudentForm, "Due date", "2026-06-01");
    await pickDate(addStudentForm, "Starts on", "2026-04-01");
    await pickDate(addStudentForm, "Ends on", "2027-03-31");
    await addStudentForm.getByRole("button", { name: "Add student" }).click();
    await expect(page).toHaveURL(/\/transport$/);

    await page.goto("/students?q=Playwright+Payment+Link");
    const row = page.getByRole("row", {
      name: /Playwright Payment Link Student/,
    });
    await row.getByRole("button", { name: "Payment link" }).click();

    const dialog = page.getByRole("dialog");
    // getPaymentLinkButtonData is fetched on open now, not server-rendered
    // into the page -- this is the one assertion waiting on that round
    // trip, so it gets a longer explicit timeout than the 5s default
    // (which is fine everywhere else, where content is already on the
    // page by the time the dialog opens).
    await expect(dialog.getByText("Pending: ₹10,000")).toBeVisible({
      timeout: 15_000,
    });

    // Part payment, well within the UPI limit -- no warning expected.
    await dialog.getByLabel("Amount (₹)").fill("4000");
    await dialog.getByRole("button", { name: "Create link" }).click();

    // RAZORPAY_MOCK=true (playwright.config.ts) makes this a deterministic
    // fake link, never a real Razorpay account or network call.
    await expect(dialog.getByText(/rzp\.io\/i\/mock/)).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Copy link" }),
    ).toBeVisible();

    // Reopening the dialog shows the same link, not a fresh create form --
    // it's still open, re-fetched fresh (getPaymentLinkButtonData) the
    // moment this second dialog instance mounts.
    await dialog.getByRole("button", { name: "Close" }).click();
    await page.reload();
    await row.getByRole("button", { name: "Payment link" }).click();
    await expect(
      page.getByRole("dialog").getByText(/rzp\.io\/i\/mock/),
    ).toBeVisible({ timeout: 15_000 });

    // Cancel it -- back to a plain create form afterward.
    await page.getByRole("dialog").getByRole("button", { name: "Cancel link" }).click();
    await expect(
      page.getByRole("dialog").getByLabel("Amount (₹)"),
    ).toBeVisible();
    await expect(
      page.getByRole("dialog").getByText(/rzp\.io\/i\/mock/),
    ).not.toBeVisible();

    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();

    // Cleanup: hard-delete this throwaway student so repeat runs don't
    // collide on the admission number. permanentlyDeleteStudent is only
    // reachable from the Students list row's own Actions menu (the detail
    // page's "Delete student" button only archives, see
    // delete-student-button.tsx), same path transport-spine.spec.ts uses
    // for Record payment.
    await row.getByRole("button", { name: "Actions" }).click();
    await page.getByRole("menuitem", { name: "Delete permanently" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete permanently" })
      .click();
    await expect(
      page.getByText("Playwright Payment Link Student"),
    ).toHaveCount(0);
  });

  test("a teacher never sees the Payment link button", async ({ page }) => {
    const teacher = TEST_TEACHERS[0];
    await page.goto("/login");
    await page.getByLabel("Username").fill(teacher.username);
    await page.getByLabel("Password").fill(teacher.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/students$/);

    await expect(
      page.getByRole("button", { name: "Payment link" }),
    ).toHaveCount(0);
  });
});

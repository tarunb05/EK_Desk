import { expect, test } from "@playwright/test";
import {
  TEST_ADMIN_EMAIL,
  TEST_ADMIN_PASSWORD,
} from "../scripts/test-credentials";

function parseRupees(text: string): number {
  return Number(text.replace(/[₹,]/g, ""));
}

async function readStat(page: import("@playwright/test").Page, testId: string) {
  return parseRupees(await page.getByTestId(testId).innerText());
}

test.describe("transport spine", () => {
  test("add student, record payment, void it, and confirm scope isolation", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_ADMIN_EMAIL);
    await page.getByLabel("Password").fill(TEST_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/transport$/);

    // Baseline figures, scoped to Kothanur.
    await page.goto("/transport?branch=BR-A");
    const baselineStudents = await readStat(page, "students-enrolled");
    const baselineReceivable = await readStat(page, "total-receivable");

    const baselineBranchB = await (async () => {
      await page.goto("/transport?branch=BR-B");
      return {
        students: await readStat(page, "students-enrolled"),
        receivable: await readStat(page, "total-receivable"),
      };
    })();

    const baselineDaycareText = await (async () => {
      await page.goto("/daycare");
      return page.locator("main").innerText();
    })();

    // Add a student with a transport fee account in Kothanur.
    await page.goto("/transport/new");
    const addStudentForm = page.locator("main");
    await addStudentForm
      .getByLabel("Branch")
      .selectOption({ label: "Kothanur" });
    await addStudentForm.getByLabel("Admission number").fill("BR-A-E2E-001");
    await addStudentForm
      .getByLabel("Student full name")
      .fill("Playwright Spine Student");
    await addStudentForm
      .getByLabel("Guardian name")
      .fill("Playwright Guardian");
    await addStudentForm.getByLabel("Phone").fill("9000000123");
    await addStudentForm.getByLabel("Class and section").fill("Nursery-A");
    await addStudentForm.getByLabel("Route").fill("Route 1 - MG Road");
    await addStudentForm.getByLabel("Pickup point").fill("Main Gate");
    await addStudentForm.getByLabel("Total receivable (₹)").fill("10000");
    await addStudentForm.getByLabel("Due date").fill("2026-06-01");
    await addStudentForm.getByLabel("Starts on").fill("2026-04-01");
    await addStudentForm.getByLabel("Ends on").fill("2027-03-31");
    await addStudentForm.getByRole("button", { name: "Add student" }).click();
    await expect(page).toHaveURL(/\/transport$/);

    // Dashboard figures for Kothanur increase by exactly the new amounts.
    await page.goto("/transport?branch=BR-A");
    expect(await readStat(page, "students-enrolled")).toBe(
      baselineStudents + 1,
    );
    expect(await readStat(page, "total-receivable")).toBe(
      baselineReceivable + 10_000,
    );

    // Record a part payment.
    await page.goto("/transport?branch=BR-A&q=Playwright+Spine");
    await page.getByRole("link", { name: "Record payment" }).click();
    await page.getByLabel("Amount (₹)").fill("4000");
    await page.getByLabel("Paid on").fill("2026-05-01");
    await page.getByLabel("Recorded by").fill("front_office");
    await page.getByRole("button", { name: "Record payment" }).click();
    await expect(page).toHaveURL(/\/transport$/);

    await page.goto("/transport?branch=BR-A");
    const afterPaymentCollected = await readStat(page, "total-collected");
    const afterPaymentPending = await readStat(page, "total-pending");

    // Void the payment via the student drawer.
    await page.goto("/transport?branch=BR-A&q=Playwright+Spine");
    await page.getByRole("link", { name: "Playwright Spine Student" }).click();
    await page.getByRole("link", { name: "Void" }).click();
    await page.getByLabel("Reason for voiding").fill("E2E spine test cleanup");
    await page.getByRole("button", { name: "Void payment" }).click();
    await expect(page).toHaveURL(/\/transport$/);

    await page.goto("/transport?branch=BR-A");
    expect(await readStat(page, "total-collected")).toBe(
      afterPaymentCollected - 4_000,
    );
    expect(await readStat(page, "total-pending")).toBe(
      afterPaymentPending + 4_000,
    );

    // Kannuru is unaffected by everything that happened in Kothanur.
    await page.goto("/transport?branch=BR-B");
    expect(await readStat(page, "students-enrolled")).toBe(
      baselineBranchB.students,
    );
    expect(await readStat(page, "total-receivable")).toBe(
      baselineBranchB.receivable,
    );

    // The daycare dashboard never changed.
    await page.goto("/daycare");
    expect(await page.locator("main").innerText()).toBe(baselineDaycareText);
  });
});

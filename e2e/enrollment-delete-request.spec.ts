import { expect, test, type Page } from "@playwright/test";
import {
  TEST_ADMIN_PASSWORD,
  TEST_ADMIN_USERNAME,
  TEST_TEACHERS,
} from "../scripts/test-credentials";

const teacher = TEST_TEACHERS[0];
// A seeded BR-A student who has two enrollments, so the menu offers
// deleting one without leaving them with nothing on file.
const TWO_ENROLLMENT_ADMISSION_NO = "BR-A-0041";

async function signIn(page: Page, username: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  // Without this, a following goto() can cancel the sign-in mid-flight.
  await expect(page).not.toHaveURL(/\/login/);
}

test.describe("deleting one enrollment", () => {
  test("a teacher requests it, and an admin sees the request and can reject it", async ({
    page,
    browser,
  }) => {
    await signIn(
      page,
      teacher.username,
      process.env.TEST_TEACHER_A_PASSWORD ?? "narahari",
    );
    // A teacher lands on the Expenses dashboard after logging in.
    await expect(page).toHaveURL(/\/expenses/);

    await page.goto(
      `/students?q=${TWO_ENROLLMENT_ADMISSION_NO}&academicYear=all`,
    );
    const row = page.getByRole("row", {
      name: new RegExp(TWO_ENROLLMENT_ADMISSION_NO),
    });
    await row.getByRole("button", { name: /actions/i }).click();

    // A teacher gets the request wording, never the direct delete.
    await expect(
      page.getByRole("menuitem", { name: /^Delete enrollment/ }),
    ).toHaveCount(0);
    await page
      .getByRole("menuitem", { name: /Request enrollment deletion/ })
      .click();
    await page.getByRole("menuitem", { name: /·/ }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("sends a request to an admin");
    await dialog.getByRole("button", { name: "Request deletion" }).click();
    await expect(page.getByText("Submitted for admin approval.")).toBeVisible();

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    try {
      await signIn(adminPage, TEST_ADMIN_USERNAME, TEST_ADMIN_PASSWORD);
      await adminPage.goto("/approvals");
      await expect(
        adminPage.getByText("Enrollment deletion requested"),
      ).toBeVisible();

      // Leave nothing queued behind: reject it.
      await adminPage
        .getByRole("button", { name: "Reject", exact: true })
        .click();
      await adminPage
        .getByPlaceholder("Reason for rejecting")
        .fill("e2e cleanup");
      await adminPage.getByRole("button", { name: "Confirm reject" }).click();
      await expect(
        adminPage.getByText("Enrollment deletion requested"),
      ).toHaveCount(0);
    } finally {
      await adminContext.close();
    }
  });
});

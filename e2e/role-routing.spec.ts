import { expect, test } from "@playwright/test";
import {
  TEST_ADMIN_USERNAME,
  TEST_ADMIN_PASSWORD,
  TEST_TEACHERS,
} from "../scripts/test-credentials";

const teacherA = TEST_TEACHERS[0];

test.describe("role-based routing (phase 8.1)", () => {
  test("admin reaches every admin route and sees the full nav", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill(TEST_ADMIN_USERNAME);
    await page.getByLabel("Password").fill(TEST_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/transport$/);
    await expect(page.getByRole("link", { name: "Transport" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Daycare" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Students" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();

    await page.goto("/daycare");
    await expect(page).toHaveURL(/\/daycare$/);
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/settings$/);
  });

  test("a teacher reaches only /students, is redirected off admin routes with a message, and the nav shows only Students", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill(teacherA.username);
    await page.getByLabel("Password").fill(teacherA.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/students$/);
    await expect(page.getByRole("link", { name: "Students" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Transport" }),
    ).not.toBeVisible();
    await expect(
      page.getByRole("link", { name: "Daycare" }),
    ).not.toBeVisible();
    await expect(
      page.getByRole("link", { name: "Settings" }),
    ).not.toBeVisible();

    await page.goto("/transport");
    await expect(page).toHaveURL(/\/students$/);
    await expect(
      page.getByText("That page isn't available for your account."),
    ).toBeVisible();

    await page.goto("/settings");
    await expect(page).toHaveURL(/\/students$/);
  });
});

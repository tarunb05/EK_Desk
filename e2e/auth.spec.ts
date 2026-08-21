import { expect, test } from "@playwright/test";
import {
  TEST_ADMIN_EMAIL,
  TEST_ADMIN_PASSWORD,
} from "../scripts/test-credentials";

test.describe("auth", () => {
  test("redirects an unauthenticated visitor to login", async ({ page }) => {
    await page.goto("/transport");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("shows an error on invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_ADMIN_EMAIL);
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Incorrect email or password.")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("logs in, shows the shell, and signs out", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_ADMIN_EMAIL);
    await page.getByLabel("Password").fill(TEST_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/transport$/);
    await expect(page.getByRole("link", { name: "Transport" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Daycare" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Students" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/transport");
    await expect(page).toHaveURL(/\/login$/);
  });
});

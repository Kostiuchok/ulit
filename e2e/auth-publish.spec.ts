import { test, expect } from "@playwright/test";

const TEST_EMAIL = `e2e-${Date.now()}@knyha-test.com`;
const TEST_PASSWORD = "e2e-secret-123";
const TEST_NAME = "E2E Test Author";

test.describe("Registration → Dashboard → Book wizard → Publish", () => {
  test("user can register and land on dashboard", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: /реєстрація/i })).toBeVisible();

    await page.getByLabel(/ім'я/i).fill(TEST_NAME);
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/пароль/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /зареєструватися/i }).click();

    await page.waitForURL("**/dashboard/**", { timeout: 15_000 });
    await expect(page.getByText(TEST_NAME)).toBeVisible();
  });

  test("registered user can log in", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /вхід/i })).toBeVisible();

    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/пароль/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /увійти/i }).click();

    await page.waitForURL("**/dashboard/**", { timeout: 15_000 });
  });

  test("login shows error for wrong password", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/пароль/i).fill("wrong-password");
    await page.getByRole("button", { name: /увійти/i }).click();

    await expect(page.getByRole("alert")).toBeVisible({ timeout: 8_000 });
  });

  test("dashboard shows books list page", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/пароль/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /увійти/i }).click();
    await page.waitForURL("**/dashboard/**");

    await page.goto("/dashboard/books");
    await expect(page.getByRole("heading", { name: /мої книги/i })).toBeVisible();
  });

  test("author can start book wizard and fill step 1 (metadata)", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/пароль/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /увійти/i }).click();
    await page.waitForURL("**/dashboard/**");

    await page.goto("/dashboard/books/new");
    await expect(page.getByRole("heading", { name: /публікація/i })).toBeVisible();

    // Step 1: metadata
    await page.getByLabel(/назва/i).fill("E2E Test Book");
    await page.getByLabel(/опис/i).fill("Книга для автоматизованого тестування.");

    const nextBtn = page.getByRole("button", { name: /далі/i });
    await expect(nextBtn).toBeEnabled();
    await nextBtn.click();

    // Should advance to step 2
    await expect(page.getByText(/крок 2/i)).toBeVisible({ timeout: 5_000 });
  });

  test("author can access settings page", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/пароль/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /увійти/i }).click();
    await page.waitForURL("**/dashboard/**");

    await page.goto("/dashboard/settings");
    await expect(page.getByRole("heading", { name: /налаштування/i })).toBeVisible();
    await expect(page.getByDisplayValue(TEST_NAME)).toBeVisible();
  });

  test("non-admin cannot access admin panel", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/пароль/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /увійти/i }).click();
    await page.waitForURL("**/dashboard/**");

    await page.goto("/admin/dashboard");
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 });
  });
});

import { test, expect, type Page } from "@playwright/test";

const TEST_EMAIL = `e2e-${Date.now()}@knyha-test.com`;
const TEST_PASSWORD = "e2e-secret-123";
const TEST_NAME = "E2E Test Author";

// Registration requires email verification (see apps/api/src/modules/auth/login.ts
// -- 403 EMAIL_NOT_VERIFIED) before a session can exist, and nothing in CI can click
// the verification link. Everything below that needs to actually be logged in uses a
// separate, pre-verified fixture account instead of the freshly registered one.
const FIXTURE_EMAIL = process.env.E2E_TEST_EMAIL;
const FIXTURE_PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe("Registration", () => {
  test("user can register and lands on the check-email confirmation", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: /створити акаунт/i })).toBeVisible();

    await page.getByLabel(/ім'я/i).fill(TEST_NAME);
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    // Two labels contain "пароль" (Пароль / Підтвердіть пароль) -- exact match
    // picks the first field, not a strict-mode ambiguity error.
    await page.getByLabel("Пароль", { exact: true }).fill(TEST_PASSWORD);
    await page.getByLabel(/підтвердіть пароль/i).fill(TEST_PASSWORD);
    // Same ambiguity as the login button: a "Зареєструватись через Google"
    // button also matches a loose /зареєструватись/i name.
    await page.getByRole("button", { name: "Зареєструватись", exact: true }).click();

    await page.waitForURL(/\/register\/check-email/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /перевірте пошту/i })).toBeVisible();
    await expect(page.getByText(TEST_EMAIL)).toBeVisible();
  });

  test("login shows error for wrong password", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/пароль/i).fill("wrong-password");
    await page.getByRole("button", { name: "Увійти", exact: true }).click();

    await expect(page.getByText(/невірний email або пароль/i)).toBeVisible({ timeout: 8_000 });
  });

  test("login blocks an unverified account even with the correct password", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/пароль/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Увійти", exact: true }).click();

    await expect(page.getByText(/email не підтверджено/i)).toBeVisible({ timeout: 8_000 });
  });
});

test.describe("Authenticated author flows", () => {
  test.skip(
    !FIXTURE_EMAIL || !FIXTURE_PASSWORD,
    "requires E2E_TEST_EMAIL/E2E_TEST_PASSWORD -- a pre-verified, non-admin fixture account"
  );

  async function login(page: Page) {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(FIXTURE_EMAIL!);
    await page.getByLabel(/пароль/i).fill(FIXTURE_PASSWORD!);
    await page.getByRole("button", { name: "Увійти", exact: true }).click();
    // Login lands on exactly "/dashboard" (login/page.tsx: router.push("/dashboard")).
    // The old glob "**/dashboard/**" needs a path segment AFTER /dashboard/, so
    // it never matched and every authenticated test timed out right here --
    // regardless of whether the credentials were right.
    const landed = page.waitForURL(//dashboard(/|$|?)/, { timeout: 15_000 });
    // A rejected login must say so, not look like a slow redirect.
    const rejected = page
      .getByText(/невірний email або пароль|email не підтверджено/i)
      .waitFor({ timeout: 15_000 })
      .then(() => {
        throw new Error("Login rejected for E2E_TEST_EMAIL -- check the E2E_TEST_EMAIL / E2E_TEST_PASSWORD secrets and that the account's email is verified");
      });
    await Promise.race([landed, rejected]);
    rejected.catch(() => undefined);
  }

  test("registered user can log in", async ({ page }) => {
    await login(page);
  });

  test("dashboard shows books list page", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard/books");
    await expect(page.getByRole("heading", { name: /мої книги/i })).toBeVisible();
  });

  test("author can start book wizard and fill step 1 (metadata)", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard/books/new");
    await expect(page.getByRole("heading", { name: /публікація/i })).toBeVisible();

    await page.getByLabel(/назва/i).fill("E2E Test Book");
    await page.getByLabel(/опис/i).fill("Книга для автоматизованого тестування.");

    const nextBtn = page.getByRole("button", { name: /далі/i });
    await expect(nextBtn).toBeEnabled();
    await nextBtn.click();

    await expect(page.getByText(/крок 2/i)).toBeVisible({ timeout: 5_000 });
  });

  test("author can access settings page", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard/settings");
    await expect(page.getByRole("heading", { name: /налаштування/i })).toBeVisible();
  });

  test("non-admin cannot access admin panel", async ({ page }) => {
    await login(page);
    await page.goto("/admin/dashboard");
    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 });
  });
});

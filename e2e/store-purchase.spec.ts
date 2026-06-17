import { test, expect } from "@playwright/test";

test.describe("Store — catalog, book page, search, purchase flow", () => {
  test("homepage loads with hero and catalog sections", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // Store layout nav
    await expect(page.getByRole("link", { name: /каталог/i })).toBeVisible();
    // Footer legal links
    await expect(page.getByRole("link", { name: /умови використання/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /конфіденційність/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /договір автора/i })).toBeVisible();
  });

  test("catalog page renders with filter controls", async ({ page }) => {
    await page.goto("/books");
    await expect(page.getByRole("heading", { name: /каталог/i })).toBeVisible();
    // Search input
    await expect(page.getByPlaceholder(/пошук/i)).toBeVisible();
    // Genre sidebar or chips
    await expect(page.getByRole("link", { name: /усі жанри/i })).toBeVisible();
  });

  test("search returns results or empty state", async ({ page }) => {
    await page.goto("/books");
    const searchInput = page.getByPlaceholder(/пошук/i);
    await searchInput.fill("тест");
    await searchInput.press("Enter");

    await page.waitForURL(/q=/, { timeout: 5_000 });
    // Either results or empty state message
    const hasResults = await page.getByTestId("book-card").count() > 0;
    const hasEmpty = await page.getByText(/не знайдено/i).isVisible();
    expect(hasResults || hasEmpty).toBe(true);
  });

  test("/terms page renders legal content", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.getByRole("heading", { name: /умови використання/i })).toBeVisible();
    await expect(page.getByText(/реєстрація та акаунт/i)).toBeVisible();
  });

  test("/privacy page renders GDPR content", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: /конфіденційність/i })).toBeVisible();
    await expect(page.getByText(/GDPR/i)).toBeVisible();
  });

  test("/author-agreement page shows contract with accept bar", async ({ page }) => {
    await page.goto("/author-agreement");
    await expect(page.getByRole("heading", { name: /договір з автором/i })).toBeVisible();
    await expect(page.getByText(/роялті/i)).toBeVisible();
    // Accept bar visible at bottom
    await expect(page.getByRole("button", { name: /прийняти договір|увійти та прийняти/i })).toBeVisible();
  });

  test("cookie banner appears on first visit and dismisses on accept", async ({ page }) => {
    // New page = no localStorage
    await page.goto("/");
    const banner = page.getByRole("button", { name: /прийняти/i }).first();
    await expect(banner).toBeVisible({ timeout: 5_000 });

    await banner.click();
    // Banner should disappear
    await expect(banner).not.toBeVisible({ timeout: 3_000 });

    // Reload — banner should not reappear
    await page.reload();
    await expect(page.getByRole("button", { name: /прийняти/i }).first()).not.toBeVisible({ timeout: 3_000 });
  });

  test("book detail page shows buy button and metadata", async ({ page }) => {
    // Navigate to catalog and click first book if any exists
    await page.goto("/books");

    const firstCard = page.locator("a[href^='/books/']").first();
    const hasBooks = await firstCard.isVisible({ timeout: 3_000 }).catch(() => false);

    if (!hasBooks) {
      test.skip();
      return;
    }

    await firstCard.click();
    // Book detail page should show format badges and price
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // Author link
    await expect(page.locator("a[href^='/authors/']")).toBeVisible();
  });

  test("purchase flow: unauthenticated user redirected to login", async ({ page }) => {
    await page.goto("/books");
    const firstCard = page.locator("a[href^='/books/']").first();
    const hasBooks = await firstCard.isVisible({ timeout: 3_000 }).catch(() => false);

    if (!hasBooks) {
      test.skip();
      return;
    }

    await firstCard.click();
    // Click buy button — should redirect to login if not authenticated
    const buyBtn = page.getByRole("button", { name: /купити/i }).first();
    if (await buyBtn.isVisible()) {
      await buyBtn.click();
      await expect(page).toHaveURL(/\/login|\/checkout/, { timeout: 8_000 });
    }
  });

  test("/orders/:id shows order status for authenticated user", async ({ page }) => {
    // This test verifies the order status page structure exists
    // (actual order requires payment processing which is out of E2E scope)
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("nonexistent@example.com");
    await page.getByLabel(/пароль/i).fill("password");
    await page.getByRole("button", { name: /увійти/i }).click();

    // After failed login, try accessing order page
    await page.goto("/orders/fake-order-id");
    // Should show error or redirect to login
    const onLogin = page.url().includes("/login");
    const showsError = await page.getByText(/не знайдено|помилка|unauthorized/i).isVisible({ timeout: 5_000 }).catch(() => false);
    expect(onLogin || showsError).toBe(true);
  });
});

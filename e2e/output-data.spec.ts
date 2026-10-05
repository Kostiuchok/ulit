import { test, expect, type Page } from "@playwright/test";

// FORMS-REFACTOR-PLAN.md: the behaviour the author-cabinet forms must keep.
// Runs after every deploy against the live site with the pre-verified
// fixture account (E2E_TEST_EMAIL / E2E_TEST_PASSWORD). Creates its own
// draft book and archives it again at the end -- it never touches any other
// book in that account.

const FIXTURE_EMAIL = process.env.E2E_TEST_EMAIL;
const FIXTURE_PASSWORD = process.env.E2E_TEST_PASSWORD;

const TITLE = `E2E чернетка ${Date.now()}`;
// 130+ characters: above ULIT's own 120 minimum, so the annotation itself is
// valid until a test shortens it on purpose.
const ANNOTATION =
  "Автоматична чернетка для перевірки форм кабінету автора. Створюється тестом після кожного деплою і видаляється наприкінці того самого запуску.";

test.describe.configure({ mode: "serial" });

test.describe("Вихідні дані: підсвічування, «Змінено», вихід зі сторінки", () => {
  test.skip(!FIXTURE_EMAIL || !FIXTURE_PASSWORD, "requires E2E_TEST_EMAIL/E2E_TEST_PASSWORD");

  let bookId = "";

  async function login(page: Page) {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(FIXTURE_EMAIL!);
    await page.getByLabel(/пароль/i).fill(FIXTURE_PASSWORD!);
    await page.getByRole("button", { name: "Увійти", exact: true }).click();
    await page.waitForURL(/\/dashboard(\/|$|\?)/, { timeout: 15_000 });
  }

  async function openOutputData(page: Page) {
    await page.goto(`/dashboard/books/${bookId}/output-data`);
    await expect(page.locator("#title")).toHaveValue(TITLE, { timeout: 15_000 });
  }

  const saveButton = (page: Page) => page.getByRole("button", { name: /зберегти зміни/i });
  const topTab = (page: Page, suffix: string) => page.locator(`nav a[href$="/output-data${suffix}"]`);

  test("створює чернетку через майстер", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard/books/new");
    await page.getByLabel(/назва книги/i).fill(TITLE);
    await page.getByLabel(/анотація/i).fill(ANNOTATION);
    await page.getByRole("combobox", { name: /вікові обмеження/i }).click();
    await page.getByRole("option", { name: "0+", exact: true }).click();
    await page.getByRole("button", { name: /зберегти і перейти на наступний крок/i }).click();
    await expect(page.getByText(/завантажити рукопис/i)).toBeVisible({ timeout: 15_000 });

    await page.goto("/dashboard/books");
    const href = await page.getByRole("link", { name: TITLE }).first().getAttribute("href");
    bookId = href?.split("/").pop() ?? "";
    expect(bookId, "id of the freshly created draft").not.toBe("");
  });

  test("незаповнене обов'язкове поле підсвічене з поясненням, «Зберегти» неактивне", async ({ page }) => {
    await login(page);
    await openOutputData(page);

    // The wizard leaves Жанр empty -- the form must say so by itself.
    await expect(page.getByText("Оберіть жанр", { exact: true }).last()).toBeVisible();

    await page.locator("#title").fill("");
    await expect(page.getByText("Вкажіть назву книги")).toBeVisible();
    await expect(saveButton(page)).toBeDisabled();

    await page.locator("#title").fill(TITLE);
    await expect(page.getByText("Вкажіть назву книги")).toHaveCount(0);

    await page.locator("#description").fill("коротко");
    await expect(page.getByText(/до мінімуму \(120\)/)).toBeVisible();
    await expect(saveButton(page)).toBeDisabled();
  });

  test("змінений блок позначено «Змінено», панель показує незбережені зміни", async ({ page }) => {
    await login(page);
    await openOutputData(page);

    await expect(page.getByText(/^Змінено ·/)).toHaveCount(0);
    await page.locator("#subtitle").fill("підзаголовок");
    await expect(page.getByText(/^Змінено · 1 поле$/)).toBeVisible();
    await expect(page.getByText("Є незбережені зміни", { exact: true })).toBeVisible();
  });

  test("вихід із незбереженими змінами питає; «Залишитись» зберігає правки, «Вийти» переходить", async ({ page }) => {
    await login(page);
    await openOutputData(page);
    await page.locator("#subtitle").fill("не збережено");

    await topTab(page, "/file").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Є незбережені зміни" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Зберегти й перейти" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Вийти без збереження" })).toBeVisible();

    await dialog.getByRole("button", { name: "Залишитись на сторінці" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/\/output-data$/);
    await expect(page.locator("#subtitle")).toHaveValue("не збережено");

    await topTab(page, "/file").click();
    await page.getByRole("dialog").getByRole("button", { name: "Вийти без збереження" }).click();
    await page.waitForURL(/\/output-data\/file$/, { timeout: 15_000 });

    // Nothing was saved.
    await openOutputData(page);
    await expect(page.locator("#subtitle")).toHaveValue("");
  });

  test("вкладки перемикаються на чистій сторінці без вікна попередження", async ({ page }) => {
    await login(page);
    await openOutputData(page);

    await topTab(page, "/price").click();
    await page.waitForURL(/\/output-data\/price$/, { timeout: 15_000 });
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await topTab(page, "/file").click();
    await page.waitForURL(/\/output-data\/file$/, { timeout: 15_000 });

    await topTab(page, "").click();
    await page.waitForURL(/\/output-data$/, { timeout: 15_000 });
  });

  test("прибирає чернетку за собою", async ({ page }) => {
    test.skip(!bookId, "no draft was created");
    await login(page);
    await page.goto("/dashboard/books");
    const status = await page.evaluate(async (id) => {
      const session = await fetch("/api/auth/session").then((r) => r.json());
      const token = session?.user?.apiToken;
      const res = await fetch(`/api/books/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: "{}",
      });
      return res.status;
    }, bookId);
    expect(status).toBe(204);
  });
});

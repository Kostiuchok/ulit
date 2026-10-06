import { test, expect, type Page } from "@playwright/test";

// FORMS-REFACTOR-PLAN.md: the behaviour the author-cabinet forms must keep.
// Runs after every deploy against the live site with the pre-verified
// fixture account (E2E_TEST_EMAIL / E2E_TEST_PASSWORD).
//
// One permanent draft, "E2E чернетка (не видаляти)", lives in that account:
// the first run creates it (one POST /api/books with the title -- the same
// request the "Нова книга" dialog sends), every later run (and every retry,
// which starts in a fresh worker with no memory of the previous attempt)
// finds and reuses it. No test here ever saves, so the draft stays exactly
// as it was created -- Жанр empty, no file, no cover, no price.
// The first version created a timestamped draft per run and archived it in
// a final test; with retries that produced several drafts and, whenever an
// earlier test failed, the clean-up test did not run at all.

const FIXTURE_EMAIL = process.env.E2E_TEST_EMAIL;
const FIXTURE_PASSWORD = process.env.E2E_TEST_PASSWORD;

const TITLE = "E2E чернетка (не видаляти)";
test.describe("Вихідні дані: підсвічування, «Змінено», вихід зі сторінки", () => {
  // Never two of these at once: they share one draft and must not race to create it.
  test.describe.configure({ mode: "default" });
  test.skip(!FIXTURE_EMAIL || !FIXTURE_PASSWORD, "requires E2E_TEST_EMAIL/E2E_TEST_PASSWORD");


  async function login(page: Page) {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(FIXTURE_EMAIL!);
    await page.getByLabel(/пароль/i).fill(FIXTURE_PASSWORD!);
    await page.getByRole("button", { name: "Увійти", exact: true }).click();
    await page.waitForURL(/\/dashboard(\/|$|\?)/, { timeout: 15_000 });
  }

  // The fixture account's books, straight from the API. NOT read off the
  // rendered list: that list fills in asynchronously, and the first version
  // of this helper looked at it too early, saw "no such book" every time and
  // created a new draft in every single test (four identical drafts per
  // deploy landed in the admin's list before it was caught).
  async function findDraftId(page: Page): Promise<string | null> {
    return page.evaluate(async (title) => {
      const session = await fetch("/api/auth/session").then((r) => r.json());
      const token = session?.user?.apiToken;
      if (!token) throw new Error("no api token in session");
      const res = await fetch("/api/books", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`GET /api/books -> ${res.status}`);
      const { books } = await res.json();
      const match = (books as { id: string; title: string; createdAt: string }[])
        .filter((b) => b.title === title)
        .sort((x, y) => String(x.createdAt ?? "").localeCompare(String(y.createdAt ?? "")))[0];
      return match?.id ?? null;
    }, TITLE);
  }

  // Finds the permanent draft, creating it only if the API says there is
  // none -- through the API as well, not by clicking through the dialog, so
  // a UI hiccup can never turn into a second draft (CLAUDE.md журнал #40).
  async function ensureDraft(page: Page): Promise<string> {
    await page.goto("/dashboard/books");
    let id = await findDraftId(page);
    if (!id) {
      id = await page.evaluate(async (title) => {
        const session = await fetch("/api/auth/session").then((r) => r.json());
        const token = session?.user?.apiToken;
        if (!token) throw new Error("no api token in session");
        const res = await fetch("/api/books", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        });
        if (!res.ok) throw new Error(`POST /api/books -> ${res.status}`);
        return (await res.json()).book.id as string;
      }, TITLE);
    }
    expect(id, "id of the fixture draft").toBeTruthy();
    return id!;
  }

  async function openOutputData(page: Page) {
    await login(page);
    const bookId = await ensureDraft(page);
    await page.goto(`/dashboard/books/${bookId}/output-data`);
    await expect(page.locator("#title")).toHaveValue(TITLE, { timeout: 20_000 });
  }

  const saveButton = (page: Page) => page.getByRole("button", { name: /зберегти зміни/i });
  // Scoped to the tab bar: the sidebar has its own «Вихідні дані» link with
  // the very same href, which made a bare `a[href$=…]` ambiguous.
  const topTab = (page: Page, suffix: string) =>
    page.getByTestId("output-data-tabs").locator(`a[href$="/output-data${suffix}"]`);

  test("незаповнене обов'язкове поле підсвічене з поясненням, «Зберегти» неактивне", async ({ page }) => {
    await openOutputData(page);

    // A new draft has no Жанр -- the form must say so by itself.
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
    await openOutputData(page);

    await page.locator("#subtitle").fill("підзаголовок");
    await expect(page.getByText(/^Змінено · \d+ пол/).first()).toBeVisible();
    await expect(page.getByText("Є незбережені зміни", { exact: true })).toBeVisible();
  });

  test("«змінено» — це різниця зі збереженим: повернув значення — позначка зникла", async ({ page }) => {
    await openOutputData(page);

    await page.locator("#subtitle").fill("тимчасово");
    await expect(page.getByText("Є незбережені зміни", { exact: true })).toBeVisible();
    await page.locator("#subtitle").fill("");
    await expect(page.getByText("Є незбережені зміни", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/^Змінено ·/)).toHaveCount(0);

    // Biography lives outside the form library -- same rule must hold there.
    const bio = page.locator("#authorBio");
    const original = await bio.inputValue();
    await bio.fill(`${original} правка`);
    await expect(page.getByText(/^Змінено · 1 блок$/)).toBeVisible();
    await bio.fill(original);
    await expect(page.getByText(/^Змінено ·/)).toHaveCount(0);

    // With everything back as saved, leaving needs no confirmation.
    await topTab(page, "/price").click();
    await page.waitForURL(/\/output-data\/price$/, { timeout: 15_000 });
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("«Ціна»: зміна гонорару вмикає незбережене, повернення — вимикає", async ({ page }) => {
    await openOutputData(page);
    await topTab(page, "/price").click();
    await page.waitForURL(/\/output-data\/price$/, { timeout: 15_000 });

    const royalty = page.getByPlaceholder("напр. 100");
    await expect(royalty).toBeVisible({ timeout: 15_000 });
    const original = await royalty.inputValue();
    await royalty.fill("77");
    await expect(page.getByText(/Є незбережені зміни у 1 блоці/)).toBeVisible();
    await royalty.fill(original);
    await expect(page.getByText(/Є незбережені зміни/)).toHaveCount(0);
  });

  test("вихід із незбереженими змінами питає; «Залишитись» зберігає правки, «Вийти» переходить", async ({ page }) => {
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
    await page.goto(page.url().replace(/\/file$/, ""));
    await expect(page.locator("#title")).toHaveValue(TITLE, { timeout: 20_000 });
    await expect(page.locator("#subtitle")).toHaveValue("");
  });

  test("кнопка «Назад» у браузері з незбереженими змінами теж питає", async ({ page }) => {
    await openOutputData(page);
    await page.locator("#subtitle").fill("не збережено");
    await expect(page.getByText("Є незбережені зміни", { exact: true })).toBeVisible();

    await page.goBack();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Є незбережені зміни" })).toBeVisible();
    await dialog.getByRole("button", { name: "Залишитись на сторінці" }).click();
    await expect(page).toHaveURL(/\/output-data$/);
    await expect(page.locator("#subtitle")).toHaveValue("не збережено");

    await page.goBack();
    await page.getByRole("dialog").getByRole("button", { name: "Вийти без збереження" }).click();
    // openOutputData came here from the books list.
    await page.waitForURL(/\/dashboard\/books$/, { timeout: 15_000 });
  });

  test("дашборд незаповненої чернетки: «Надіслати на модерацію» неактивна, кроки видно", async ({ page }) => {
    await login(page);
    const bookId = await ensureDraft(page);
    await page.goto(`/dashboard/books/${bookId}`);

    await expect(page.getByRole("heading", { name: TITLE })).toBeVisible({ timeout: 20_000 });
    // The fixture draft has no file, cover or price -- nothing to send yet.
    await expect(page.getByRole("button", { name: /надіслати на модерацію/i })).toBeDisabled();
    await expect(page.getByText(/Наступний крок · \d+ з 13/)).toBeVisible();

    const stepsToggle = page.getByRole("button", { name: /\d+ з 13 кроків виконано/ });
    await expect(stepsToggle).toBeVisible();
    await stepsToggle.click();
    await expect(page.getByText("Обкладинку додано", { exact: true })).toBeVisible();
  });

  test("вкладки перемикаються на чистій сторінці без вікна попередження", async ({ page }) => {
    await openOutputData(page);

    await topTab(page, "/price").click();
    await page.waitForURL(/\/output-data\/price$/, { timeout: 15_000 });
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await topTab(page, "/file").click();
    await page.waitForURL(/\/output-data\/file$/, { timeout: 15_000 });

    await topTab(page, "").click();
    await page.waitForURL(/\/output-data$/, { timeout: 15_000 });
  });
});

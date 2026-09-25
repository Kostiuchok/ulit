import fs from "fs";
import path from "path";
import { expect, test, type Browser, type Page } from "@playwright/test";

const AUTHOR_EMAIL = process.env.E2E_TEST_EMAIL;
const AUTHOR_PASSWORD = process.env.E2E_TEST_PASSWORD;
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;

const RUN_ID = Date.now();
const BOOK_TITLE = `E2E sprint3 ${RUN_ID}`;
const DESCRIPTION =
  "Анотація автоматичного тесту Sprint 3. Книга створена, щоб перевірити майстер публікації, передперегляд без помилок консолі та появу в каталозі після модерації.";

const DOCX = path.join(__dirname, "../fixtures/e2e-manuscript.docx");
const COVER = path.join(__dirname, "../fixtures/e2e-cover.png");

const state: { bookId?: string; slug?: string; token?: string } = {};

const BENIGN_CONSOLE = [/favicon/i, /ResizeObserver loop/i, /Download the React DevTools/i];

function trackPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (BENIGN_CONSOLE.some((re) => re.test(text))) return;
    errors.push(`console.error: ${text}`);
  });
  return errors;
}

async function dismissCookies(page: Page) {
  const accept = page.getByRole("button", { name: "Прийняти", exact: true });
  if (await accept.isVisible().catch(() => false)) {
    await accept.click();
  }
}

async function login(page: Page, email: string, password: string, url: RegExp) {
  await page.goto("/login");
  await dismissCookies(page);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Увійти", exact: true }).click();
  await page.waitForURL(url, { timeout: 20_000 });
}

async function authorToken(page: Page): Promise<string> {
  const res = await page.request.get("/api/auth/session");
  const body = (await res.json()) as { user?: { apiToken?: string } };
  const token = body.user?.apiToken;
  if (!token) throw new Error("session has no apiToken");
  state.token = token;
  return token;
}

async function api<T>(page: Page, pathname: string, init?: { method?: string; data?: unknown; multipart?: boolean }): Promise<T> {
  const token = state.token ?? (await authorToken(page));
  const method = init?.method ?? "GET";
  const res = await page.request.fetch(pathname, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.data != null && !init.multipart ? { "Content-Type": "application/json" } : {}),
    },
    data: init?.data != null && !init.multipart ? JSON.stringify(init.data) : undefined,
  });
  if (!res.ok()) {
    throw new Error(`${method} ${pathname} → ${res.status()} ${await res.text()}`);
  }
  if (res.status() === 204) return undefined as T;
  return (await res.json()) as T;
}

test.describe.configure({ mode: "serial" });

test.beforeEach(() => {
  test.skip(!AUTHOR_EMAIL || !AUTHOR_PASSWORD, "requires E2E_TEST_EMAIL and E2E_TEST_PASSWORD");
});

test.afterAll(async ({ request }) => {
  if (!state.token || !state.bookId) return;
  const res = await request.delete(`/api/books/${state.bookId}`, {
    headers: { Authorization: `Bearer ${state.token}`, "Content-Type": "application/json" },
    data: {},
  });
  // 204 archived, 400 already archived — either means it left the catalog.
  if (res.status() !== 204 && res.status() !== 400) {
    console.error(`cleanup DELETE /api/books/${state.bookId} → ${res.status()} ${await res.text()}`);
  }
});

test("author walks the wizard and saves a draft", async ({ page }) => {
  test.setTimeout(360_000);
  await login(page, AUTHOR_EMAIL!, AUTHOR_PASSWORD!, /\/dashboard/);
  await authorToken(page);

  const me = await api<{ user: { contractAcceptedAt?: string | null; bio?: string | null; firstName?: string | null; lastName?: string | null } }>(
    page,
    "/api/users/me"
  );
  if (!me.user.contractAcceptedAt) {
    await page.goto("/dashboard/settings/contract");
    await page.locator("#taxIdUnsigned").fill("0000000000");
    await page.locator("#bankIbanUnsigned").fill("UA000000000000000000000000000");
    await page.locator("#payoutDocumentUnsigned").fill("E2E тестовий документ, не для виплат");
    await page.getByRole("checkbox").nth(0).check();
    await page.getByRole("checkbox").nth(1).check();
    await page.getByRole("button", { name: "Підписати договір" }).click();
    await expect(page.getByText(/дату ухвалення|підписан/i).first()).toBeVisible({ timeout: 15_000 });
  }

  await page.goto("/dashboard/books/new");
  await expect(page.getByRole("heading", { name: /основна інформація/i })).toBeVisible();

  const created = page.waitForResponse(
    (r) => r.url().includes("/api/books") && r.request().method() === "POST" && r.ok()
  );
  await page.getByLabel(/назва книги/i).fill(BOOK_TITLE);
  await page.getByLabel(/анотація/i).fill(DESCRIPTION);
  await page.locator("#genre").click();
  await page.getByRole("option", { name: "Проза", exact: true }).click();
  await page.locator("#ageRating").click();
  await page.getByRole("option", { name: "0+", exact: true }).click();
  await page.getByRole("button", { name: /зберегти і перейти/i }).click();
  const createRes = await created;
  const createdBody = (await createRes.json()) as { book: { id: string; slug: string } };
  state.bookId = createdBody.book.id;
  state.slug = createdBody.book.slug;

  await expect(page.getByRole("heading", { name: /завантажити рукопис/i })).toBeVisible();
  await page.locator("input[type=file]").setInputFiles(DOCX);
  await page.getByRole("button", { name: /завантажити та конвертувати/i }).click();
  await expect(page.getByText(/рукопис оброблено/i)).toBeVisible({ timeout: 240_000 });

  await page.getByRole("button", { name: /зберегти і перейти/i }).click();
  await expect(page.getByRole("heading", { name: /формати, ціни/i })).toBeVisible();
  await page.locator("#royaltyEbook").fill("40");
  await page.locator("#royaltyPrint").fill("30");
  await page.locator("#pricePrintBw").fill("200");
  await page.getByRole("button", { name: /зберегти і перейти/i }).click();

  await expect(page.getByRole("heading", { name: /огляд та публікація/i })).toBeVisible();
  await expect(page.getByText(BOOK_TITLE)).toBeVisible();
  await page.getByRole("button", { name: /зберегти чернетку/i }).click();
  await page.waitForURL(new RegExp(`/dashboard/books/${state.bookId}`), { timeout: 20_000 });
});

test("author fills the remaining publish fields and submits for moderation", async ({ page }) => {
  test.setTimeout(180_000);
  expect(state.bookId, "wizard test did not create a book").toBeTruthy();
  await login(page, AUTHOR_EMAIL!, AUTHOR_PASSWORD!, /\/dashboard/);
  await authorToken(page);

  const { book } = await api<{ book: Record<string, unknown> }>(page, `/api/books/${state.bookId}`);
  const authors = Array.isArray(book.bookAuthors) ? book.bookAuthors : [];
  const bio = typeof book.authorBio === "string" ? book.authorBio.trim() : "";

  await page.goto(`/dashboard/books/${state.bookId}/output-data`);
  await expect(page.locator("#authorBio")).toBeVisible({ timeout: 20_000 });
  if (!bio) {
    const current = await page.locator("#authorBio").inputValue();
    if (!current.trim()) {
      await page.locator("#authorBio").fill("E2E автор. Коротка біографія для автоматичного тесту публікації.");
    }
  }
  if (authors.length === 0) {
    const fill = page.getByRole("button", { name: /заповнити поля з кабінету/i });
    if (await fill.isVisible().catch(() => false)) {
      await fill.click();
      await page.getByRole("button", { name: /додати автора/i }).click();
    }
  }
  const save = page.getByRole("button", { name: "Зберегти зміни", exact: true });
  if (await save.isEnabled()) {
    await save.click();
    await expect(page.getByText(/збережено/i).first()).toBeVisible({ timeout: 15_000 });
  }

  // Cover designer is a Fabric canvas. Try the real save button, then the
  // same upload endpoint the designer posts to if the canvas never paints.
  await page.goto(`/dashboard/books/${state.bookId}/cover`);
  const saveCover = page.getByRole("button", { name: "Зберегти обкладинку" });
  await expect(saveCover).toBeVisible({ timeout: 30_000 });
  await saveCover.click();
  const savedBanner = page.getByText(/обкладинку збережено/i);
  const saved = await savedBanner.waitFor({ state: "visible", timeout: 25_000 }).then(() => true).catch(() => false);
  if (!saved) {
    const token = state.token!;
    const res = await page.request.post(`/api/books/${state.bookId}/upload-cover`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        file: {
          name: "e2e-cover.png",
          mimeType: "image/png",
          buffer: fs.readFileSync(COVER),
        },
      },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
  }

  const ready = await api<{ book: { authorBio?: string | null; bookAuthors?: unknown; coverUrl?: string | null } }>(
    page,
    `/api/books/${state.bookId}`
  );
  if (!ready.book.authorBio?.trim() || !Array.isArray(ready.book.bookAuthors) || ready.book.bookAuthors.length === 0) {
    const me = await api<{ user: { firstName?: string | null; lastName?: string | null; bio?: string | null } }>(
      page,
      "/api/users/me"
    );
    await api(page, `/api/books/${state.bookId}`, {
      method: "PATCH",
      data: {
        authorBio: ready.book.authorBio?.trim() || me.user.bio?.trim() || "E2E автор. Коротка біографія для автоматичного тесту публікації.",
        bookAuthors:
          Array.isArray(ready.book.bookAuthors) && ready.book.bookAuthors.length > 0
            ? undefined
            : [{ lastName: me.user.lastName || "Тестовий", firstName: me.user.firstName || "Автор" }],
      },
    });
  }

  await page.goto(`/dashboard/books/${state.bookId}/output-data/publish?autovalidate=1`);
  const confirm = page.getByRole("button", { name: "Підтвердити надсилання" });
  const errors = page.getByText(/необхідно виправити/i);
  await expect(confirm.or(errors)).toBeVisible({ timeout: 20_000 });
  if (await errors.isVisible()) {
    throw new Error(`publish validation failed: ${await errors.locator("xpath=..").innerText()}`);
  }
  await page.getByRole("checkbox", { name: /влаштовує вигляд книги/i }).check();
  await confirm.click();
  await expect(page.getByText(/на модерації/i)).toBeVisible({ timeout: 20_000 });
});

test("print preview loads with no console.error or pageerror", async ({ page }) => {
  test.setTimeout(120_000);
  expect(state.bookId).toBeTruthy();
  const errors = trackPageErrors(page);
  await login(page, AUTHOR_EMAIL!, AUTHOR_PASSWORD!, /\/dashboard/);
  await page.goto(`/dashboard/books/${state.bookId}/manuscript/preview`);
  await expect(page.getByRole("button", { name: "Оновити" })).toBeVisible({ timeout: 90_000 });
  // DONE only paints "Оновити". The flipbook then fetches the PDF; wait for
  // a canvas (react-pdf) so a load-time console.error is not missed.
  await page.locator("canvas").first().waitFor({ state: "visible", timeout: 60_000 });
  await page.waitForTimeout(1_000);
  expect(errors, errors.join("\n")).toEqual([]);
});

test("admin rejects the submission and the book stays out of the catalog", async ({ page, browser }) => {
  test.setTimeout(120_000);
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "requires E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD — add these GitHub Actions secrets");
  expect(state.slug).toBeTruthy();

  await rejectOrApprove(browser, "reject");

  const missing = await page.request.get(`/api/store/books/${state.slug}`);
  expect(missing.status()).toBe(404);
  await page.goto(`/books/${state.slug}`);
  await expect(page.getByRole("heading", { name: BOOK_TITLE })).toHaveCount(0);
});

test("author resubmits after rejection", async ({ page }) => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "requires E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD — add these GitHub Actions secrets");
  expect(state.bookId).toBeTruthy();
  await login(page, AUTHOR_EMAIL!, AUTHOR_PASSWORD!, /\/dashboard/);
  await authorToken(page);
  await page.goto(`/dashboard/books/${state.bookId}/output-data/publish?autovalidate=1`);
  const confirm = page.getByRole("button", { name: "Підтвердити надсилання" });
  await expect(confirm).toBeVisible({ timeout: 20_000 });
  await page.getByRole("checkbox", { name: /влаштовує вигляд книги/i }).check();
  await confirm.click();
  await expect(page.getByText(/на модерації/i)).toBeVisible({ timeout: 20_000 });
});

test("admin approves and the book appears in the catalog", async ({ page, browser }) => {
  test.setTimeout(120_000);
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "requires E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD — add these GitHub Actions secrets");
  expect(state.slug).toBeTruthy();

  await rejectOrApprove(browser, "approve");

  await expect.poll(async () => (await page.request.get(`/api/store/books/${state.slug}`)).status(), { timeout: 20_000 }).toBe(200);

  await page.goto(`/books/${state.slug}`);
  await dismissCookies(page);
  await expect(page.getByRole("heading", { name: BOOK_TITLE })).toBeVisible();

  await page.goto(`/books?q=${encodeURIComponent(BOOK_TITLE)}`);
  await expect(page.getByRole("link", { name: BOOK_TITLE }).first()).toBeVisible({ timeout: 15_000 });
});

async function rejectOrApprove(browser: Browser, action: "reject" | "approve") {
  const context = await browser.newContext();
  const admin = await context.newPage();
  try {
    await login(admin, ADMIN_EMAIL!, ADMIN_PASSWORD!, /\/admin/);
    await admin.goto("/admin/books");
    const search = admin.getByPlaceholder(/пошук за назвою/i);
    await search.fill(BOOK_TITLE);
    const row = admin.locator("tr", { hasText: BOOK_TITLE });
    await expect(row).toBeVisible({ timeout: 20_000 });
    if (action === "reject") {
      // ActionChip prefixes a check/cross glyph, so the accessible name is
      // not exactly "Відхилити". $/ anchors past "Відхилити зміни".
      await row.getByRole("button", { name: /Відхилити$/ }).click();
      const dialog = admin.getByRole("dialog");
      await dialog.getByPlaceholder(/причина/i).fill("E2E: тестове відхилення, книгу можна надіслати знову.");
      await dialog.getByRole("button", { name: "Відхилити", exact: true }).click();
      await expect(dialog).toBeHidden({ timeout: 15_000 });
    } else {
      await row.getByRole("button", { name: /Схвалити$/ }).click();
      await expect(row.getByText(/опубліковано/i)).toBeVisible({ timeout: 20_000 });
    }
  } finally {
    await context.close();
  }
}

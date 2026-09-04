import { z } from "zod";

export * from "./manuscript";

// ─── Enums ───────────────────────────────────────────────────────────────────

export type Role = "AUTHOR" | "ADMIN";

export type BookStatus = "DRAFT" | "PROCESSING" | "REVIEW" | "PUBLISHED" | "ARCHIVED";

export type ModerationStatus = "PENDING" | "APPROVED" | "REJECTED";

export type DistributionStrategy = "WIDE" | "KDP_SELECT";

export type DistributionChannel = "ULIT" | "D2D" | "KDP" | "GOOGLE";

// Runtime companion to the DistributionChannel type above -- z.enum (and any
// `<select>`/checkbox list rendering the same options) needs an actual
// array, not just a type. Single source for apps/api's distribution.ts
// (switchSchema), book.ts (patchSchema), and books.ts (createSchema), which
// each previously declared this exact 4-value tuple independently.
export const DISTRIBUTION_CHANNELS = ["ULIT", "D2D", "KDP", "GOOGLE"] as const;

// Was four independent copies of this exact 6-value list -- apps/api's
// book.ts patchSchema and books.ts createSchema each had their own z.enum([
// ...]), and apps/web's output-data/page.tsx and BookWizard.tsx each had
// their own plain `const AGE_RATINGS = [...]` (checked only via
// z.string().min(1) client-side, not a real enum -- see ageRatingSchema
// below).
export const AGE_RATINGS = ["0+", "0-6", "6-10", "11-14", "15-17", "18+"] as const;
export type AgeRating = (typeof AGE_RATINGS)[number];

export type ExternalStatus = "NOT_SENT" | "SENT" | "PUBLISHED" | "ERROR";

export type OrderStatus = "PENDING" | "PAID" | "FULFILLED" | "CANCELLED";

export type RoyaltyStatus = "PENDING" | "PAID";

export type BookFormat = "EPUB" | "FB2" | "MOBI" | "PRINT";

// Print formats per ДСТУ 3018-95 (Ukrainian state standard for book/print
// formats -- see docs/ridero-print-format-selection-guide.md for full sourcing
// and cross-references against two other sources that used conflicting names
// for the same sheet fractions). "Стандартний" (84x108/32 -> 130x200mm) is the
// dominant format for fiction specifically -- confirmed 2026-08-17.
export type PrintFormatKey =
  | "miniature"    // Мініатюрний, 60x84/32
  | "pocket"       // Кишеньковий, 75x90/32
  | "standard"      // Стандартний, 84x108/32 -- dominant fiction format
  | "encyclopedic"  // Енциклопедичний, 60x90/16
  | "enlarged"      // Збільшений, 70x100/16
  | "large"         // Дуже великий, 60x90/8
  | "a4"            // А4, ISO 216 -- not a ДСТУ sheet-fraction format
  | "statement"     // Statement, US trade size (5.5x8.5") -- a Google Docs page-size preset
  | "executive";    // Executive, US trade size (7.25x10.5") -- a Google Docs page-size preset

export interface PrintFormat {
  key: PrintFormatKey;
  label: string;
  sheetFraction: string;
  widthMm: number;
  heightMm: number;
  purpose: string;
}

export const PRINT_FORMATS: Record<PrintFormatKey, PrintFormat> = {
  miniature: { key: "miniature", label: "Мініатюрний", sheetFraction: "60×84/32", widthMm: 100, heightMm: 140, purpose: "словники, кишенькові довідники" },
  pocket: { key: "pocket", label: "Кишеньковий", sheetFraction: "75×90/32", widthMm: 107, heightMm: 177, purpose: "художня література в м'якій обкладинці, поезія" },
  standard: { key: "standard", label: "Стандартний", sheetFraction: "84×108/32", widthMm: 130, heightMm: 200, purpose: "основний формат художньої літератури" },
  encyclopedic: { key: "encyclopedic", label: "Енциклопедичний", sheetFraction: "60×90/16", widthMm: 145, heightMm: 215, purpose: "навчальна, наукова та довідкова література" },
  enlarged: { key: "enlarged", label: "Збільшений", sheetFraction: "70×100/16", widthMm: 170, heightMm: 240, purpose: "спецлітература, дитячі книжки" },
  large: { key: "large", label: "Дуже великий", sheetFraction: "60×90/8", widthMm: 220, heightMm: 290, purpose: "альбоми мистецтва, атласи, ілюстровані видання" },
  a4: { key: "a4", label: "А4", sheetFraction: "ISO 216", widthMm: 210, heightMm: 297, purpose: "підручники, робочі зошити, видання з великою кількістю таблиць/схем" },
  statement: { key: "statement", label: "Statement", sheetFraction: "US trade, 5.5×8.5″", widthMm: 140, heightMm: 216, purpose: "зручний розмір для авторів, які пишуть у Google Docs" },
  executive: { key: "executive", label: "Executive", sheetFraction: "US trade, 7.25×10.5″", widthMm: 184, heightMm: 267, purpose: "зручний розмір для авторів, які пишуть у Google Docs" },
};

// Display order for the "Розмір книги" selector -- BookWizard.tsx and
// output-data/page.tsx both render this same list, "standard" first as the
// platform default, so the two independent size pickers (creation-time and
// post-creation edit) never drift apart on ordering.
export const PRINT_FORMAT_KEYS: PrintFormatKey[] = [
  "standard", "pocket", "miniature", "encyclopedic", "enlarged", "large", "a4", "statement", "executive",
];

// Fixed language list -- was two independently maintained copies with
// actually different content, not just different code: output-data/page.tsx
// had 9 languages with flag emoji baked into the label; BookWizard.tsx had
// only 5 (missing es/it/pt/ru entirely) with no flags -- an author could
// pick Spanish for their book in the wizard's own <select>, save, reload on
// output-data, and see a 9-option list where "Español" was there all along
// (just never offered at creation time). Neither page's Zod schema checked
// the value was actually one of these anyway (see languageSchema below).
export const LANGUAGES = [
  { code: "uk", label: "🇺🇦 Українська" },
  { code: "en", label: "🇬🇧 English" },
  { code: "de", label: "🇩🇪 Deutsch" },
  { code: "fr", label: "🇫🇷 Français" },
  { code: "pl", label: "🇵🇱 Polski" },
  { code: "es", label: "🇪🇸 Español" },
  { code: "it", label: "🇮🇹 Italiano" },
  { code: "pt", label: "🇵🇹 Português" },
  { code: "ru", label: "Русский" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

export const languageSchema = z.enum(
  LANGUAGES.map((l) => l.code) as [LanguageCode, ...LanguageCode[]]
);

// Fixed genre list -- was three independent copies (BookWizard.tsx and
// output-data/page.tsx each had their own `const GENRES = [...]`, validated
// as free text with only a max(100) length cap at the Zod level on both the
// frontend AND apps/api's book.ts/books.ts -- a real enum only existed
// implicitly, as GENRE_TO_PRINT_FORMAT's object keys below, which nothing
// actually validated against). A book's genre must be one of these to be
// usable as a lookup key (GENRE_TO_PRINT_FORMAT, future genre-based
// features) instead of arbitrary free text.
export const GENRES = [
  "Проза", "Поезія", "Драматургія", "Наукова фантастика", "Фентезі",
  "Детектив", "Роман", "Повість", "Оповідання", "Нон-фікшн",
  "Мемуари", "Бізнес", "Самодопомога", "Дитяча", "Інше",
] as const;
export type Genre = (typeof GENRES)[number];

// Genre -> recommended default print format. A proposed mapping
// (2026-08-17), not independently re-confirmed per-genre against ДСТУ --
// open to correction. BookWizard now has its own independent "Розмір книги"
// selector (not derived from genre) -- this mapping only still matters
// server-side (apps/api books.ts POST/book.ts PATCH) as the fallback
// default for a book that has no print size on record yet (e.g. the format
// field was omitted from the create request).
export const GENRE_TO_PRINT_FORMAT: Record<Genre, PrintFormatKey> = {
  "Проза": "standard",
  "Поезія": "pocket",
  "Драматургія": "standard",
  "Наукова фантастика": "standard",
  "Фентезі": "standard",
  "Детектив": "standard",
  "Роман": "standard",
  "Повість": "standard",
  "Оповідання": "standard",
  "Нон-фікшн": "encyclopedic",
  "Мемуари": "standard",
  "Бізнес": "encyclopedic",
  "Самодопомога": "encyclopedic",
  "Дитяча": "enlarged",
  "Інше": "standard",
};

// Pure enum membership check -- the .optional()/"" escape hatch for a
// <select>'s empty placeholder option lives at each call site (output-data,
// BookWizard), not here, same reasoning as ageRatingSchema's own comment.
export const genreSchema = z.enum(GENRES);

// Platform's default print trim size when no genre-derived format applies yet
// (e.g. before the author picks a genre) -- ДСТУ "Стандартний", 130x200mm,
// decided 2026-08-17 (dominant format for fiction specifically). Per-book
// actual trim is Book.printWidthMm/printHeightMm (Prisma), defaulted from
// GENRE_TO_PRINT_FORMAT when genre changes unless the author overrode it --
// this constant is only the fallback/pre-genre default, not a fixed
// platform-wide size. Single source of truth for that fallback: the docx
// page-size upload validation (apps/api), the cover editor canvas geometry,
// and every UI display must read from here, not hardcode the numbers
// separately.
export const PRINT_TRIM_SIZE_MM = PRINT_FORMATS.standard;
export const PRINT_TRIM_SIZE_LABEL = "130 × 200 мм (стандартний, ДСТУ 3018-95)";

// Single place that decides "what's this book's actual print trim size" --
// genre-derived default, unless the author/admin explicitly overrode
// printWidthMm/printHeightMm (book.ts PATCH handler persists the override;
// this only resolves what to *display*/*build geometry from*, given
// whatever's already on the book). Used by output-data's own display
// (previously duplicated this logic inline) and by the cover editor's
// canvas geometry (previously didn't use it at all -- always rendered at
// the PRINT_TRIM_SIZE_MM fallback ratio regardless of the book's real
// format, which is a genre-driven aspect ratio that can range from
// pocket's 107x177 (~0.605) to large's 220x290 (~0.759); the printed file
// itself always used the real size, only the cover design canvas didn't).
export function resolveBookPrintFormat(book: {
  genre?: string | null;
  printWidthMm?: number | null;
  printHeightMm?: number | null;
  printFormatKey?: string | null;
}): PrintFormat {
  // Cast, not a narrowed type -- this reads whatever is already on a Book
  // record, including rows saved before genre was enforced as an enum
  // (or any other legacy free text); the `?? "standard"` fallback is what
  // actually keeps this safe for a genre that isn't a real Genre key, the
  // cast just satisfies the stricter Record<Genre, ...> index type.
  const genreFormat = book.genre
    ? PRINT_FORMATS[GENRE_TO_PRINT_FORMAT[book.genre as Genre] ?? "standard"]
    : PRINT_FORMATS.standard;
  if (book.printWidthMm && book.printHeightMm) {
    return {
      key: (book.printFormatKey as PrintFormatKey) ?? genreFormat.key,
      label: genreFormat.key === book.printFormatKey ? genreFormat.label : "Індивідуальний",
      sheetFraction: genreFormat.sheetFraction,
      purpose: genreFormat.purpose,
      widthMm: book.printWidthMm,
      heightMm: book.printHeightMm,
    };
  }
  return genreFormat;
}

// ─── User ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  slug: string;
  bio?: string;
  avatarUrl?: string;
  role: Role;
  contractAcceptedAt?: string;
  createdAt: string;
}

// ─── Book ────────────────────────────────────────────────────────────────────

export interface Book {
  id: string;
  slug: string;
  title: string;
  description?: string;
  authorId: string;
  author?: Pick<User, "id" | "name" | "slug" | "avatarUrl">;
  status: BookStatus;
  moderationStatus: ModerationStatus;
  moderationNote?: string;
  isbn?: string;
  coverUrl?: string;
  priceEbook?: number;
  pricePrint?: number;
  genre?: string;
  language: string;
  pageCount?: number;
  distributionStrategy: DistributionStrategy;
  distributionChannels: DistributionChannel[];
  kdpSelectEnrolled: boolean;
  kdpSelectExpiry?: string;
  d2dStatus: ExternalStatus;
  kdpStatus: ExternalStatus;
  googleStatus: ExternalStatus;
  createdAt: string;
  publishedAt?: string;
}

// ─── Price fields ─────────────────────────────────────────────────────────────

// One shape for every per-format sale price (priceEbook, pricePrint,
// pricePrintHardcover, pricePrintBw, pricePrintHardcoverBw) -- was five
// fields independently written out field-by-field in both apps/api's
// book.ts patchSchema and books.ts createSchema (POST's copy didn't even
// have `.nullable()`, and didn't list the two Bw fields at all), while
// pricePrintBw/pricePrintHardcoverBw ALSO had their own separate frontend
// z.coerce schema on output-data (priceEbook/pricePrint/pricePrintHardcover
// had no frontend schema at all, computed via computeAnchorPrices and sent
// raw). Same underlying rule for all five either way: a positive number, or
// null/absent to mean "not sold in this format".
export const priceFieldSchema = z.number().positive().nullable().optional();

// Frontend raw-<input type="number">-specific companion -- "" is a valid
// "author hasn't typed anything (yet)" state a controlled input needs to
// hold, which priceFieldSchema's `number` type can't represent; coerces to
// a real number once non-empty. Only pricePrintBw/pricePrintHardcoverBw are
// ever typed directly through a raw input like this -- priceEbook/
// pricePrint/pricePrintHardcover are derived from a royalty input via
// computeAnchorPrices (FormatsAndDistribution.tsx), never typed directly.
export const priceInputSchema = z.coerce.number().positive().optional().or(z.literal(""));

// ─── Publish readiness ────────────────────────────────────────────────────────

// Was independently reimplemented in THREE places before this: the
// backend's actual pre-publish gate (apps/api/.../publish.ts validateBook),
// the author-facing "Вихідні дані" page's per-section checkbox/heading
// (apps/web/.../output-data/page.tsx), and a second copy of these same two
// constants in apps/web/lib/rejectedBlocks.ts -- e.g. this exact number,
// confirmed by a live Ridero test (2026-08-17, T-2060 п.1/п.3), had three
// independent copies that could each drift without the other two noticing.
export const DESCRIPTION_MIN_LENGTH = 120;
export const DESCRIPTION_MAX_LENGTH = 500;

// Fields every check below reads. Loose (`unknown`) for the price fields --
// same reasoning as RejectionSnapshotBook above: Prisma's Decimal type isn't
// assignable to string|number|null, and these are only ever read through a
// truthiness check, never arithmetic.
export interface PublishStepBook {
  title?: string | null;
  description?: string | null;
  ageRating?: string | null;
  coverUrl?: string | null;
  originalDocxUrl?: string | null;
  pdfUrl?: string | null;
  epubUrl?: string | null;
  priceEbook?: unknown;
  pricePrint?: unknown;
  pricePrintHardcover?: unknown;
  pricePrintBw?: unknown;
  pricePrintHardcoverBw?: unknown;
  desiredRoyaltyAmount?: unknown;
  desiredRoyaltyAmountPrint?: unknown;
  // `unknown`, same reasoning as the price fields above -- the backend reads
  // this straight off a Prisma `Json?` column (no structural array type),
  // while the frontend's own Book interface already has a real
  // `BookAuthor[]`. Narrowed safely inside the check below either way.
  bookAuthors?: unknown;
}

export type PublishFieldKey = "title" | "description" | "ageRating" | "cover" | "file" | "price" | "bookAuthors";

export interface PublishFieldCheck {
  key: PublishFieldKey;
  isComplete: (book: PublishStepBook) => boolean;
}

// One check per field the backend's pre-publish gate actually enforces --
// kept at this granularity (not grouped into sections yet) because the
// backend also needs a per-FIELD error message ("Анотація має бути від 120
// до 500 символів (зараз 43)", not just "Інформація неповна"), which is a
// backend-only concern that stays in publish.ts; the shared, importable
// part is only "is this field ok", not how to phrase telling someone it isn't.
export const PUBLISH_FIELD_CHECKS: PublishFieldCheck[] = [
  { key: "title", isComplete: (b) => !!b.title?.trim() },
  {
    key: "description",
    isComplete: (b) => {
      const len = (b.description ?? "").trim().length;
      return len >= DESCRIPTION_MIN_LENGTH && len <= DESCRIPTION_MAX_LENGTH;
    },
  },
  { key: "ageRating", isComplete: (b) => !!b.ageRating },
  {
    // Previously nothing at all required at least one listed author -- a
    // book could reach REVIEW/PUBLISHED with an empty bookAuthors array (e.g.
    // the author removed their own auto-added entry and never added anyone
    // else). Same non-empty-name check IsbnReadinessChecklist already used
    // for its own (non-blocking) "ПІБ автора" item -- promoted here so it
    // actually gates the "info" step/nav pill/pre-publish validate, not just
    // a hint that only ever showed up once a print price was set.
    key: "bookAuthors",
    isComplete: (b) => {
      const authors = Array.isArray(b.bookAuthors) ? (b.bookAuthors as Array<Record<string, unknown>>) : [];
      return authors.some(
        (a) => typeof a?.lastName === "string" && a.lastName.trim() && typeof a?.firstName === "string" && a.firstName.trim()
      );
    },
  },
  { key: "cover", isComplete: (b) => !!b.coverUrl },
  { key: "file", isComplete: (b) => !!(b.originalDocxUrl || b.pdfUrl || b.epubUrl) },
  {
    // T-2060 п.9/п.11 -- either the legacy per-format prices or the new
    // desired-royalty-per-unit satisfies this; see publish.ts for why there's
    // no separate per-channel price to require individually.
    key: "price",
    isComplete: (b) =>
      !!(
        b.priceEbook ||
        b.pricePrint ||
        b.pricePrintHardcover ||
        b.pricePrintBw ||
        b.pricePrintHardcoverBw ||
        b.desiredRoyaltyAmount ||
        b.desiredRoyaltyAmountPrint
      ),
  },
];

export function isPublishFieldComplete(key: PublishFieldKey, book: PublishStepBook): boolean {
  return PUBLISH_FIELD_CHECKS.find((c) => c.key === key)!.isComplete(book);
}

export type PublishStepKey = "info" | "file" | "cover" | "price";

// output-data/page.tsx's own section keys (info/file/cover/price -- "review"
// and "publish" aren't readiness checks of their own, they read off these
// four) -- each maps to the PUBLISH_FIELD_CHECKS keys that make up that
// section, so a section's checkbox/heading can never disagree with what
// validateBook (the actual pre-publish gate) requires of the same fields.
export const PUBLISH_STEP_FIELDS: Record<PublishStepKey, PublishFieldKey[]> = {
  info: ["title", "description", "ageRating", "bookAuthors"],
  file: ["file"],
  cover: ["cover"],
  price: ["price"],
};

export function isPublishStepComplete(step: PublishStepKey, book: PublishStepBook): boolean {
  return PUBLISH_STEP_FIELDS[step].every((key) => isPublishFieldComplete(key, book));
}

export function isReadyToPublish(book: PublishStepBook): boolean {
  return (Object.keys(PUBLISH_STEP_FIELDS) as PublishStepKey[]).every((step) => isPublishStepComplete(step, book));
}

// Per-channel minimum annotation length a STORE actually prefers, beyond
// Ulit's own baseline (DESCRIPTION_MIN_LENGTH) -- same numbers as the
// existing informational badges (output-data/page.tsx's
// DESCRIPTION_PLATFORM_TARGETS, admin's distribute/page.tsx per-platform
// checklist), which stay purely advisory (⚠, never blocking) for a channel
// the author hasn't enabled. Once a channel IS enabled, its length becomes
// an actual save-time requirement instead of a hint -- an author who turns
// on Amazon KDP distribution but never lengthens the annotation past Ulit's
// own 120-char floor would otherwise ship a book KDP's own algorithm
// penalizes, with no signal stronger than a badge that's easy to miss.
const CHANNEL_DESCRIPTION_MIN_LENGTH: Partial<Record<DistributionChannel, number>> = {
  KDP: 250,
  GOOGLE: 150,
};

export function getRequiredDescriptionMinLength(channels: readonly string[] | null | undefined): number {
  let min = DESCRIPTION_MIN_LENGTH;
  for (const channel of channels ?? []) {
    const channelMin = CHANNEL_DESCRIPTION_MIN_LENGTH[channel as DistributionChannel];
    if (channelMin && channelMin > min) min = channelMin;
  }
  return min;
}

// ─── Book field schemas (Zod) ─────────────────────────────────────────────────

// Single source for a handful of Book-field rules that were independently
// reimplemented (and had already drifted -- see the field-by-field audit
// behind this change) across apps/api's book.ts (PATCH) + books.ts (POST)
// and apps/web's output-data/page.tsx + BookWizard.tsx. Not every Book field
// lives here -- only the ones that had multiple independent copies; fields
// validated in exactly one place stay defined there.

export const ageRatingSchema = z.enum(AGE_RATINGS);

export const distributionChannelsSchema = z
  .array(z.enum(DISTRIBUTION_CHANNELS))
  .min(1, "Оберіть хоча б одну платформу")
  .refine((ch) => ch.includes("ULIT"), "Магазин Ulit завжди обов'язковий");

// T-2060 п.4 -- structured per-book authors, independent of the account
// profile. Previously validated ONLY on the backend (apps/api's book.ts) --
// the frontend's "Автори книги" add-author form had no length/URL checks of
// its own at all, just ad hoc `.trim()` truthiness.
export const bookAuthorSchema = z.object({
  lastName: z.string().min(1).max(100),
  firstName: z.string().min(1).max(100),
  middleName: z.string().max(100).optional(),
  photoUrl: z.string().url().optional(),
});

// ─── Rejection reasons (admin reject flow) ───────────────────────────────────

// Fixed taxonomy the admin picks from (checkboxes) when rejecting a book,
// instead of a single freeform textarea -- lets author-facing pages know
// EXACTLY which field a rejection is about (no more guessing from keywords
// in a note), and lets them detect "resolved" as "this field's value
// differs from what it was at the moment of rejection"
// (isRejectionReasonResolved below) instead of merely "this field is
// non-empty". The latter can't tell a rejection for a MISSING value apart
// from one for a WRONG-but-present value (e.g. admin picks "Жанр" because
// the genre is wrong, not missing -- genre already has a value both before
// and after rejection until the author actually changes it).
export type RejectionReasonKey =
  | "cover"
  | "manuscript"
  | "title"
  | "description"
  | "genre"
  | "author"
  | "language"
  | "price";

export interface RejectionReasonDef {
  key: RejectionReasonKey;
  label: string; // admin checkbox label
  noteText: string; // canonical sentence composed into moderationNote (email + legacy display)
  section: "info" | "file" | "price" | "cover-page"; // which author-facing page/section this jumps to
}

export const REJECTION_REASONS: RejectionReasonDef[] = [
  { key: "cover", label: "Обкладинка", noteText: "Обкладинка не відповідає вимогам.", section: "cover-page" },
  { key: "manuscript", label: "Рукопис", noteText: "Рукопис потребує доопрацювання.", section: "file" },
  { key: "title", label: "Назва книги", noteText: "Назву книги потрібно виправити.", section: "info" },
  { key: "description", label: "Анотація", noteText: "Анотацію потрібно виправити.", section: "info" },
  { key: "genre", label: "Жанр", noteText: "Жанр вказано некоректно.", section: "info" },
  { key: "author", label: "Автори книги", noteText: "Дані про авторів потребують виправлення.", section: "info" },
  { key: "language", label: "Мова книги", noteText: "Мову книги вказано некоректно.", section: "info" },
  { key: "price", label: "Ціна та розповсюдження", noteText: "Ціна та умови розповсюдження потребують перегляду.", section: "price" },
];

// Loose on purpose -- Decimal price fields arrive as string|number depending
// on the caller (Prisma client vs already-JSON-serialized API response), and
// isRejectionReasonResolved compares via JSON.stringify, which doesn't care.
export interface RejectionSnapshotBook {
  title?: string | null;
  description?: string | null;
  genre?: string | null;
  language?: string | null;
  coverUrl?: string | null;
  docxUpdatedAt?: string | Date | null;
  bookAuthors?: unknown;
  // `unknown` rather than string|number|null -- Prisma's own Decimal type
  // (priceEbook etc. are `Decimal? @db.Decimal` in schema.prisma) isn't
  // assignable to either, and getRejectionSnapshotValue only ever reads
  // these through JSON.stringify (Decimal serializes to a string via its
  // own toJSON()), so exact typing here buys nothing but friction for every
  // caller.
  priceEbook?: unknown;
  pricePrint?: unknown;
  pricePrintHardcover?: unknown;
  pricePrintBw?: unknown;
  pricePrintHardcoverBw?: unknown;
  desiredRoyaltyAmount?: unknown;
  desiredRoyaltyAmountPrint?: unknown;
}

// The single value a rejection reason's "resolved" check hinges on -- read
// fresh both when the admin rejects (the snapshot written then) and whenever
// a page wants to know "has this changed since". Serialized identically at
// both sites (this same function), so a plain JSON.stringify comparison in
// isRejectionReasonResolved is enough, no per-field equality logic needed.
export function getRejectionSnapshotValue(key: RejectionReasonKey, book: RejectionSnapshotBook): unknown {
  switch (key) {
    case "cover":
      return book.coverUrl ?? null;
    case "manuscript":
      // docxUpdatedAt (not originalDocxUrl) -- it exists specifically to
      // track "did the source content change" (same field the republish
      // flow already keys off), so re-uploading the same file under the
      // same URL still wouldn't falsely look "unchanged" the way comparing
      // a URL string could.
      return book.docxUpdatedAt ? String(book.docxUpdatedAt) : null;
    case "title":
      return book.title ?? null;
    case "description":
      return book.description ?? null;
    case "genre":
      return book.genre ?? null;
    case "author":
      return book.bookAuthors ?? null;
    case "language":
      return book.language ?? null;
    case "price":
      return {
        priceEbook: book.priceEbook ?? null,
        pricePrint: book.pricePrint ?? null,
        pricePrintHardcover: book.pricePrintHardcover ?? null,
        pricePrintBw: book.pricePrintBw ?? null,
        pricePrintHardcoverBw: book.pricePrintHardcoverBw ?? null,
        desiredRoyaltyAmount: book.desiredRoyaltyAmount ?? null,
        desiredRoyaltyAmountPrint: book.desiredRoyaltyAmountPrint ?? null,
      };
  }
}

// A reason is resolved once the field it's about differs from its value at
// the moment of rejection (the snapshot) -- catches both "was missing, now
// has a value" AND "had a wrong value, now has a different one", which
// simple presence-checking never could. No snapshot recorded for this key
// (a legacy rejection from before this system existed) means "can't tell" --
// stays flagged until the admin re-reviews, same as before.
export function isRejectionReasonResolved(
  key: RejectionReasonKey,
  book: RejectionSnapshotBook,
  snapshot: Partial<Record<RejectionReasonKey, unknown>> | null | undefined
): boolean {
  if (!snapshot || !(key in snapshot)) return false;
  const current = getRejectionSnapshotValue(key, book);
  return JSON.stringify(current) !== JSON.stringify(snapshot[key]);
}

// ─── Order ───────────────────────────────────────────────────────────────────

export interface OrderItem {
  id: string;
  bookId: string;
  book?: Pick<Book, "id" | "title" | "coverUrl">;
  format: BookFormat;
  price: number;
}

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  paymentId?: string;
  createdAt: string;
}

// ─── Royalty ─────────────────────────────────────────────────────────────────

export interface Royalty {
  id: string;
  authorId: string;
  bookId: string;
  book?: Pick<Book, "id" | "title">;
  amount: number;
  source: string;
  status: RoyaltyStatus;
  paidAt?: string;
  createdAt: string;
}

// ─── API Responses ───────────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  code?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  hasNext: boolean;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface AuthTokenPayload {
  userId: string;
  email: string;
  role: Role;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

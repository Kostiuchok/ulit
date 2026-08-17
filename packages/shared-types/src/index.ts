export * from "./manuscript";

// ─── Enums ───────────────────────────────────────────────────────────────────

export type Role = "AUTHOR" | "ADMIN";

export type BookStatus = "DRAFT" | "PROCESSING" | "REVIEW" | "PUBLISHED" | "ARCHIVED";

export type ModerationStatus = "PENDING" | "APPROVED" | "REJECTED";

export type DistributionStrategy = "WIDE" | "KDP_SELECT";

export type DistributionChannel = "ULIT" | "D2D" | "KDP" | "GOOGLE";

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
  | "large";        // Дуже великий, 60x90/8

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
};

// Genre (from GENRES in BookWizard.tsx / output-data page) -> recommended
// default print format. A proposed mapping (2026-08-17), not independently
// re-confirmed per-genre against ДСТУ -- open to correction. Author can
// override the auto-picked format manually; this only sets the default.
export const GENRE_TO_PRINT_FORMAT: Record<string, PrintFormatKey> = {
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

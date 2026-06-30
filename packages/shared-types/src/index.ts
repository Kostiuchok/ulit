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

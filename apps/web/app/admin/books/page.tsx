"use client";

import { useEffect, useState, useCallback, useRef, type MouseEvent as ReactMouseEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useApi } from "../../../hooks/useApi";


interface Book {
  id: string;
  title: string;
  status: string;
  moderationStatus: string;
  isbn?: string | null;
  coverUrl?: string | null;
  genre?: string | null;
  language?: string;
  publishedAt?: string | null;
  rejectedAt?: string | null;
  republishRequestedAt?: string | null;
  publicationTimeline?: Record<string, string> | null;
  distributionStrategy?: string;
  d2dStatus: string;
  kdpStatus: string;
  googleStatus: string;
  priceEbook?: string | null;
  pricePrint?: string | null;
  pricePrintHardcover?: string | null;
  epubUrl?: string | null;
  fb2Url?: string | null;
  mobiUrl?: string | null;
  printPdfUrl?: string | null;
  author: { id: string; name: string; email: string };
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  PROCESSING: "bg-blue-100 text-blue-700",
  REVIEW: "bg-yellow-100 text-yellow-700",
  PUBLISHED: "bg-green-100 text-green-700",
  UNPUBLISHED: "bg-orange-100 text-orange-700",
  ARCHIVED: "bg-gray-100 text-gray-500",
};

const MOD_COLORS: Record<string, string> = {
  PENDING: "bg-orange-100 text-orange-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

const EXT_COLORS: Record<string, string> = {
  NOT_SENT: "text-gray-400",
  SENT: "text-blue-600",
  PUBLISHED: "text-green-600",
  ERROR: "text-red-600",
};

const EXT_ICONS: Record<string, string> = {
  NOT_SENT: "○",
  SENT: "↑",
  PUBLISHED: "✓",
  ERROR: "✕",
};

function formatDateTime(date: string): string {
  return new Date(date).toLocaleString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface TimelineEntry {
  key: string;
  title: string;
  date: string;
  badgeLabel: string;
  badgeClassName: string;
}

// One place a book's whole moderation/publication history is derived from
// -- each lifecycle timestamp paired with the status badge it produced, so
// "коли" and "що" are never two things an admin has to visually line up
// across separate columns. Sorted chronologically (oldest first) since this
// reads as a history, not a snapshot -- the last line is always the book's
// current effective state.
function buildStatusTimeline(book: Book): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  if (book.publicationTimeline?.submitted) {
    entries.push({ key: "submitted", title: "Вперше надіслано на модерацію", date: book.publicationTimeline.submitted, badgeLabel: "REVIEW", badgeClassName: STATUS_COLORS.REVIEW });
  }
  if (book.publicationTimeline?.lastSubmitted && book.publicationTimeline.lastSubmitted !== book.publicationTimeline?.submitted) {
    entries.push({ key: "lastSubmitted", title: "Востаннє повторно надіслано на модерацію", date: book.publicationTimeline.lastSubmitted, badgeLabel: "REVIEW", badgeClassName: STATUS_COLORS.REVIEW });
  }
  if (book.moderationStatus === "APPROVED" && book.publicationTimeline?.review_done) {
    entries.push({ key: "approved", title: "Дата затвердження адміном", date: book.publicationTimeline.review_done, badgeLabel: "APPROVED", badgeClassName: MOD_COLORS.APPROVED });
  }
  if (book.status === "PUBLISHED" && book.publishedAt) {
    entries.push({ key: "published", title: "Дата публікації в магазині", date: book.publishedAt, badgeLabel: "PUBLISHED", badgeClassName: STATUS_COLORS.PUBLISHED });
  }
  if (book.status === "DRAFT" && book.moderationStatus === "REJECTED" && book.rejectedAt) {
    entries.push({ key: "rejected", title: "Дата відхилення адміном", date: book.rejectedAt, badgeLabel: "REJECTED", badgeClassName: MOD_COLORS.REJECTED });
  }
  if (book.status === "PUBLISHED" && book.republishRequestedAt) {
    entries.push({ key: "republish", title: "Автор надіслав зміни в опублікованій книзі", date: book.republishRequestedAt, badgeLabel: "ЗМІНИ НА МОДЕРАЦІЇ", badgeClassName: "bg-amber-100 text-amber-700" });
  }
  return entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// Events that land at the exact same instant (approve+publish both stamp
// `now` in the same request) collapse onto one line -- two badges, one date
// -- instead of two lines that would otherwise repeat the identical time.
function groupTimelineByInstant(entries: TimelineEntry[]): { time: number; items: TimelineEntry[] }[] {
  const groups: { time: number; items: TimelineEntry[] }[] = [];
  for (const e of entries) {
    const t = new Date(e.date).getTime();
    const g = groups.find((g) => g.time === t);
    if (g) g.items.push(e);
    else groups.push({ time: t, items: [e] });
  }
  return groups;
}

// Resizable admin/books table -- one width per column, persisted so an
// admin's preferred proportions survive a reload. Column order/count here
// must stay in sync with the <colgroup>/<th> list below.
const TABLE_COLUMNS = [
  "Книга",
  "Статус",
  "Чеклист",
  "Розповсюдження",
  "Публікація",
  "Відхилити",
  "Дистрибуція",
  "Файли",
] as const;
const DEFAULT_COLUMN_WIDTHS = [260, 200, 110, 105, 100, 90, 100, 80];
const COLUMN_WIDTHS_STORAGE_KEY = "ulit-admin-books-col-widths";
// Per-column, not a single flat floor -- narrowing e.g. "Дистрибуція" down
// to the old generic 60px let its "Розіслати"/"Публікація" label wrap onto
// three lines and visually spill past the button's own border. Each floor
// here is roughly the narrowest a column can go while its ActionChip
// buttons (icon + a 1-2 word label, now wrapping instead of overflowing)
// still read as a button, not a fixed measurement of any specific render.
const MIN_COLUMN_WIDTHS = [160, 90, 85, 70, 70, 65, 75, 55];

function loadColumnWidths(): number[] {
  if (typeof window === "undefined") return DEFAULT_COLUMN_WIDTHS;
  try {
    const raw = window.localStorage.getItem(COLUMN_WIDTHS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.length === DEFAULT_COLUMN_WIDTHS.length && parsed.every((w) => typeof w === "number")) {
      // A width saved before MIN_COLUMN_WIDTHS existed (or shrunk before
      // this fix) could be narrower than today's floor -- clamp on load too,
      // not just during an active drag.
      return parsed.map((w, i) => Math.max(MIN_COLUMN_WIDTHS[i] ?? 60, w));
    }
  } catch {
    // malformed/blocked localStorage -- fall back to defaults below
  }
  return DEFAULT_COLUMN_WIDTHS;
}

function Checklist({ book }: { book: Book }) {
  const checks = [
    { label: "Обкладинка", ok: !!book.coverUrl },
    { label: "EPUB", ok: !!book.epubUrl },
    { label: "ISBN", ok: !!book.isbn },
    { label: "Ціна", ok: !!(book.priceEbook || book.pricePrint || book.pricePrintHardcover) },
  ];
  return (
    <div className="flex flex-col gap-0.5">
      {checks.map((c) => (
        <span
          key={c.label}
          className={`flex items-center gap-1.5 text-xs font-medium ${c.ok ? "text-green-600" : "text-gray-300"}`}
        >
          <span className="w-3 shrink-0 text-center">{c.ok ? "✓" : "○"}</span>
          <span>{c.label}</span>
        </span>
      ))}
    </div>
  );
}

// Icon-on-top, label-below chip shared by every action in the 4 Дії
// columns -- they used to each place their icon inline before the text in
// whatever order felt natural at the time, which read as inconsistent
// across buttons sitting right next to each other. One shape, one rule:
// icon always centered on top. Renders as a Link (href given), a button
// (onClick given), or a static badge (neither -- an already-resolved state
// like "✓ Опубліковано").
function ActionChip({
  icon,
  label,
  onClick,
  href,
  disabled,
  title,
  className,
}: {
  icon: string;
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  title?: string;
  className: string;
}) {
  // items-center (not stretch) means a child's width is its own content's
  // natural width, not the button's -- the label span was never actually
  // constrained to the button, so text just overflowed past the border
  // instead of wrapping when a column got narrowed. w-full on the label
  // forces it to the button's real width so long-enough labels wrap inside
  // it, and min-w-0 on the button itself lets a flex/table-cell parent
  // actually shrink it below the label's own unwrapped width in the first
  // place.
  const base =
    "flex w-full min-w-0 flex-col items-center gap-0.5 rounded-md border px-1.5 py-1.5 text-center leading-tight transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const content = (
    <>
      <span className="text-sm leading-none">{icon}</span>
      <span className="w-full break-words text-[0.6875rem] font-medium leading-tight">{label}</span>
    </>
  );
  if (href) {
    return (
      <Link href={href} title={title} className={`${base} ${className}`}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} title={title} className={`${base} ${className}`}>
        {content}
      </button>
    );
  }
  return (
    <span title={title} className={`${base} ${className}`}>
      {content}
    </span>
  );
}

function BookRow({
  book,
  rejected,
  actionLoading,
  onApprove,
  onRejectClick,
  onFilesClick,
  onApproveRepublish,
  onRejectRepublish,
}: {
  book: Book;
  rejected: boolean;
  actionLoading: string | null;
  onApprove: (id: string) => void;
  onRejectClick: (id: string) => void;
  onFilesClick: (book: Book) => void;
  onApproveRepublish: (id: string) => void;
  onRejectRepublish: (id: string) => void;
}) {
  const pendingRepublish = book.status === "PUBLISHED" && !!book.republishRequestedAt;
  return (
    <tr className={`transition-colors ${rejected ? "bg-gray-50 text-gray-400 grayscale" : "hover:bg-gray-50"}`}>
      <td className="px-4 py-3">
        <div className="flex items-start gap-3">
          {book.coverUrl ? (
            <img src={book.coverUrl} alt="" className="h-12 w-8 rounded object-cover shrink-0" />
          ) : (
            <div className="h-12 w-8 rounded bg-gray-100 flex items-center justify-center text-lg shrink-0">📖</div>
          )}
          <div className="min-w-0">
            <Link
              href={`/admin/books/${book.id}/distribute`}
              className={`block truncate max-w-xs font-medium hover:underline ${rejected ? "text-gray-500" : "text-gray-900"}`}
            >
              {book.title}
            </Link>
            <p className="text-xs text-gray-400">{book.author.name}</p>
            {book.isbn && <p className="text-xs font-mono text-gray-400">{book.isbn}</p>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        {(() => {
          const entries = buildStatusTimeline(book);
          if (entries.length === 0) {
            // No history at all -- e.g. a fresh, never-submitted draft.
            // Falls back to the plain current-status badge alone.
            return (
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${rejected ? "bg-gray-200 text-gray-500" : STATUS_COLORS[book.status] ?? "bg-gray-100 text-gray-600"}`}>
                {book.status}
              </span>
            );
          }
          const groups = groupTimelineByInstant(entries);
          return (
            <div className={`space-y-1 text-xs ${rejected ? "text-gray-400" : "text-gray-600"}`}>
              {groups.map((g) => (
                <div
                  key={g.time}
                  className="flex flex-wrap items-center gap-1.5"
                  title={g.items.map((e) => e.title).join(" · ")}
                >
                  {g.items.map((e) => (
                    <span
                      key={e.key}
                      className={`inline-flex rounded-full px-1.5 py-0.5 text-[0.6875rem] font-medium ${rejected ? "bg-gray-200 text-gray-500" : e.badgeClassName}`}
                    >
                      {e.badgeLabel}
                    </span>
                  ))}
                  <span>{formatDateTime(g.items[0].date)}</span>
                </div>
              ))}
            </div>
          );
        })()}
      </td>
      <td className="px-4 py-3">
        <Checklist book={book} />
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-0.5 text-xs font-medium">
          <span className={`flex items-center gap-1.5 ${rejected ? "text-gray-400" : EXT_COLORS[book.d2dStatus]}`}>
            <span className="w-3 shrink-0 text-center">{EXT_ICONS[book.d2dStatus]}</span>
            <span>D2D</span>
          </span>
          <span className={`flex items-center gap-1.5 ${rejected ? "text-gray-400" : EXT_COLORS[book.kdpStatus]}`}>
            <span className="w-3 shrink-0 text-center">{EXT_ICONS[book.kdpStatus]}</span>
            <span>KDP</span>
          </span>
          <span className={`flex items-center gap-1.5 ${rejected ? "text-gray-400" : EXT_COLORS[book.googleStatus]}`}>
            <span className="w-3 shrink-0 text-center">{EXT_ICONS[book.googleStatus]}</span>
            <span>Google</span>
          </span>
        </div>
      </td>
      {/* Дії split into one column per action TYPE (not per row) so the same
          kind of action always lands in the same column across every book --
          scannable at a glance instead of hunting a crowded single cell. */}
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          {pendingRepublish && (
            <ActionChip
              icon="✓"
              label="Схвалити зміни"
              onClick={() => onApproveRepublish(book.id)}
              disabled={actionLoading === book.id + "_approveRepublish"}
              className="border-transparent bg-green-600 text-white hover:bg-green-700"
            />
          )}
          {book.status === "PUBLISHED" ? (
            <ActionChip icon="✓" label="Опубліковано" className="border-green-200 bg-green-50 text-green-700" />
          ) : book.moderationStatus === "APPROVED" ? (
            <ActionChip icon="✓" label="Схвалено" className="border-green-200 bg-green-50 text-green-700" />
          ) : (
            (book.status === "REVIEW" || book.moderationStatus === "PENDING") && (
              <ActionChip
                icon="✓"
                label="Схвалити"
                onClick={() => onApprove(book.id)}
                disabled={actionLoading === book.id + "_approve"}
                title="Схвалює перевірку і одразу публікує книгу на Ulit (ISBN + статус Опубліковано)"
                className="border-transparent bg-green-600 text-white hover:bg-green-700"
              />
            )
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          {pendingRepublish && (
            <ActionChip
              icon="✕"
              label="Відхилити зміни"
              onClick={() => onRejectRepublish(book.id)}
              disabled={actionLoading === book.id + "_rejectRepublish"}
              className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
            />
          )}
          {book.status !== "DRAFT" && (
            <ActionChip
              icon="✕"
              label="Відхилити"
              onClick={() => onRejectClick(book.id)}
              className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
            />
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        {(book.status === "PUBLISHED" || book.moderationStatus === "APPROVED") && (
          <ActionChip
            icon="📦"
            label={book.status === "PUBLISHED" ? "Розіслати" : "Публікація"}
            href={`/admin/books/${book.id}/distribute`}
            className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
          />
        )}
      </td>
      <td className="px-4 py-3">
        <ActionChip
          icon="📁"
          label="Файли"
          onClick={() => onFilesClick(book)}
          title="Завантажити файли"
          className="border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
        />
      </td>
    </tr>
  );
}

function safeFilename(title: string) {
  return title.replace(/[\\/:*?"<>|]/g, "_").trim().slice(0, 80);
}

export default function AdminBooksPage() {
  const searchParams = useSearchParams();
  const { apiFetch, token } = useApi();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [filesBook, setFilesBook] = useState<Book | null>(null);
  const [fileLoading, setFileLoading] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "");
  const [modFilter, setModFilter] = useState(searchParams.get("mod") ?? "");
  const [search, setSearch] = useState("");

  const [colWidths, setColWidths] = useState<number[]>(DEFAULT_COLUMN_WIDTHS);
  useEffect(() => { setColWidths(loadColumnWidths()); }, []);
  const resizeRef = useRef<{ index: number; startX: number; startWidth: number } | null>(null);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    const r = resizeRef.current;
    if (!r) return;
    const next = Math.max(MIN_COLUMN_WIDTHS[r.index] ?? 60, r.startWidth + (e.clientX - r.startX));
    setColWidths((prev) => prev.map((w, i) => (i === r.index ? next : w)));
  }, []);

  const handleResizeEnd = useCallback(() => {
    resizeRef.current = null;
    document.removeEventListener("mousemove", handleResizeMove);
    document.removeEventListener("mouseup", handleResizeEnd);
    setColWidths((prev) => {
      try {
        window.localStorage.setItem(COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(prev));
      } catch {
        // storage blocked/full -- widths still apply for this session
      }
      return prev;
    });
  }, [handleResizeMove]);

  function handleResizeStart(index: number, e: ReactMouseEvent) {
    e.preventDefault();
    resizeRef.current = { index, startX: e.clientX, startWidth: colWidths[index] };
    document.addEventListener("mousemove", handleResizeMove);
    document.addEventListener("mouseup", handleResizeEnd);
  }

  const activeBooks = books.filter((b) => b.moderationStatus !== "REJECTED");
  const rejectedBooks = books.filter((b) => b.moderationStatus === "REJECTED");

  const fetchBooks = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (modFilter) params.set("moderationStatus", modFilter);
    if (search) params.set("q", search);
    try {
      const data = await apiFetch<{ books: Book[] }>(`/api/admin/books?${params}`);
      setBooks(data.books);
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter, modFilter, search]);

  useEffect(() => { fetchBooks(); }, [fetchBooks]);

  async function handleApprove(id: string) {
    setActionLoading(id + "_approve");
    try {
      await apiFetch(`/api/admin/books/${id}/approve`, { method: "PATCH", body: JSON.stringify({}) });
      await fetchBooks();
    } catch (e: any) {
      alert(`Помилка схвалення: ${e.message}`);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(id: string) {
    setActionLoading(id + "_reject");
    try {
      await apiFetch(`/api/admin/books/${id}/reject`, {
        method: "PATCH",
        body: JSON.stringify({ reason: rejectReason }),
      });
      setRejectId(null);
      setRejectReason("");
      await fetchBooks();
    } catch (e: any) {
      alert(`Помилка відхилення: ${e.message}`);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleApproveRepublish(id: string) {
    setActionLoading(id + "_approveRepublish");
    try {
      await apiFetch(`/api/admin/books/${id}/republish`, { method: "PATCH", body: JSON.stringify({}) });
      await fetchBooks();
    } catch (e: any) {
      alert(`Помилка схвалення змін: ${e.message}`);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRejectRepublish(id: string) {
    const reason = window.prompt("Причина відхилення змін (буде надіслана автору):") ?? "";
    setActionLoading(id + "_rejectRepublish");
    try {
      await apiFetch(`/api/admin/books/${id}/republish/reject`, {
        method: "PATCH",
        body: JSON.stringify({ reason }),
      });
      await fetchBooks();
    } catch (e: any) {
      alert(`Помилка відхилення змін: ${e.message}`);
    } finally {
      setActionLoading(null);
    }
  }

  async function downloadFile(bookId: string, type: string, filename: string) {
    setFileLoading(type);
    try {
      const res = await fetch(`/api/admin/books/${bookId}/file/${type}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ""}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`Помилка завантаження: ${e.message}`);
    } finally {
      setFileLoading(null);
    }
  }

  function downloadMeta(book: Book) {
    const meta = {
      id: book.id, title: book.title, isbn: book.isbn,
      author: book.author.name, genre: book.genre, language: book.language,
      priceEbook: book.priceEbook, pricePrint: book.pricePrint, pricePrintHardcover: book.pricePrintHardcover,
      distributionStrategy: book.distributionStrategy, publishedAt: book.publishedAt,
    };
    const blob = new Blob([JSON.stringify(meta, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeFilename(book.title)}-metadata.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Книги</h1>
        <div className="text-sm text-gray-500">{books.length} знайдено</div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 rounded-xl border bg-white p-4 shadow-sm">
        <input
          type="search"
          placeholder="Пошук за назвою…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 rounded-md border px-3 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-gray-300"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
        >
          <option value="">Всі статуси</option>
          {["DRAFT", "PROCESSING", "REVIEW", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={modFilter}
          onChange={(e) => setModFilter(e.target.value)}
          className="h-9 rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
        >
          <option value="">Будь-яка модерація</option>
          {["PENDING", "APPROVED", "REJECTED"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 animate-pulse">Завантаження…</div>
        ) : books.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Книг не знайдено</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-sm" style={{ tableLayout: "fixed", width: colWidths.reduce((a, b) => a + b, 0) }}>
              <colgroup>
                {colWidths.map((w, i) => (
                  <col key={TABLE_COLUMNS[i]} style={{ width: w }} />
                ))}
              </colgroup>
              <thead className="border-b bg-gray-50">
                <tr>
                  {TABLE_COLUMNS.map((label, i) => (
                    <th key={label} className="relative px-4 py-3 text-left font-semibold text-gray-600 select-none">
                      <span className="block truncate">{label}</span>
                      {/* Drag handle -- widens/narrows this column only, persisted to
                          localStorage on mouseup so an admin's preferred layout survives
                          a reload instead of resetting to the defaults every visit. A
                          visible resting-state bar (not just a hover reveal) signals
                          upfront that the column is resizable, not just on discovery. */}
                      <span
                        onMouseDown={(e) => handleResizeStart(i, e)}
                        className="absolute right-0 top-2 bottom-2 w-1.5 cursor-col-resize rounded-full bg-gray-300 transition-colors hover:bg-gray-400 active:bg-gray-500"
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {activeBooks.map((book) => (
                  <BookRow
                    key={book.id}
                    book={book}
                    rejected={false}
                    actionLoading={actionLoading}
                    onApprove={handleApprove}
                    onRejectClick={setRejectId}
                    onFilesClick={setFilesBook}
                    onApproveRepublish={handleApproveRepublish}
                    onRejectRepublish={handleRejectRepublish}
                  />
                ))}
                {rejectedBooks.length > 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Відхилені</span>
                        <div className="h-px flex-1 bg-gray-200" />
                      </div>
                    </td>
                  </tr>
                )}
                {rejectedBooks.map((book) => (
                  <BookRow
                    key={book.id}
                    book={book}
                    rejected
                    actionLoading={actionLoading}
                    onApprove={handleApprove}
                    onRejectClick={setRejectId}
                    onFilesClick={setFilesBook}
                    onApproveRepublish={handleApproveRepublish}
                    onRejectRepublish={handleRejectRepublish}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject modal */}
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-xl bg-white p-6 shadow-xl w-full max-w-sm space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Відхилити книгу</h2>
            <p className="text-sm text-gray-500">Вкажіть причину відхилення (буде надіслана автору).</p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Причина відхилення…"
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleReject(rejectId)}
                disabled={actionLoading === rejectId + "_reject"}
                className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading === rejectId + "_reject" ? "…" : "Відхилити"}
              </button>
              <button
                onClick={() => { setRejectId(null); setRejectReason(""); }}
                className="flex-1 rounded-lg border py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Скасувати
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Files modal */}
      {filesBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setFilesBook(null)}>
          <div className="rounded-xl bg-white p-6 shadow-xl w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Файли книги</h2>
                <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{filesBook.title}</p>
              </div>
              <button onClick={() => setFilesBook(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>

            <div className="space-y-2">
              {[
                { type: "epub",  label: "EPUB",       ext: "epub",  available: !!filesBook.epubUrl },
                { type: "fb2",   label: "FB2",        ext: "fb2",   available: !!filesBook.fb2Url },
                { type: "mobi",  label: "MOBI",       ext: "mobi",  available: !!filesBook.mobiUrl },
                { type: "print", label: "Print PDF",  ext: "pdf",   available: !!filesBook.printPdfUrl },
                { type: "cover", label: "Обкладинка", ext: "jpg",   available: !!filesBook.coverUrl },
              ].map(({ type, label, ext, available }) => (
                <div key={type} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <span className={`text-sm font-medium ${available ? "text-gray-800" : "text-gray-300"}`}>
                    {label}
                  </span>
                  {available ? (
                    <button
                      onClick={() => downloadFile(filesBook.id, type, `${safeFilename(filesBook.title)}.${ext}`)}
                      disabled={fileLoading === type}
                      className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                    >
                      {fileLoading === type ? "…" : "⬇ Скачати"}
                    </button>
                  ) : (
                    <span className="text-xs text-gray-300">Немає</span>
                  )}
                </div>
              ))}

              {/* Metadata — always available */}
              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                <span className="text-sm font-medium text-gray-800">Метадані JSON</span>
                <button
                  onClick={() => downloadMeta(filesBook)}
                  className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                >
                  ⬇ Скачати
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

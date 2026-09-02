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

function formatDateOnly(date: string): string {
  return new Date(date).toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatTimeOnly(date: string): string {
  return new Date(date).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
}

// Resizable admin/books table -- one width per column, persisted so an
// admin's preferred proportions survive a reload. Column order/count here
// must stay in sync with the <colgroup>/<th> list below.
const TABLE_COLUMNS = [
  "Книга",
  "Статус",
  "Дата/час",
  "Чеклист",
  "D2D / KDP / Google",
  "Публікація",
  "Відхилити",
  "Дистрибуція",
  "Файли",
] as const;
const DEFAULT_COLUMN_WIDTHS = [260, 110, 140, 190, 150, 140, 110, 120, 90];
const COLUMN_WIDTHS_STORAGE_KEY = "ulit-admin-books-col-widths";
const MIN_COLUMN_WIDTH = 60;

function loadColumnWidths(): number[] {
  if (typeof window === "undefined") return DEFAULT_COLUMN_WIDTHS;
  try {
    const raw = window.localStorage.getItem(COLUMN_WIDTHS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.length === DEFAULT_COLUMN_WIDTHS.length && parsed.every((w) => typeof w === "number")) {
      return parsed;
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
    <div className="flex gap-1.5">
      {checks.map((c) => (
        <span
          key={c.label}
          title={c.label}
          className={`text-xs font-medium ${c.ok ? "text-green-600" : "text-gray-300"}`}
        >
          {c.ok ? "✓" : "○"} {c.label}
        </span>
      ))}
    </div>
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
        <div className="space-y-1">
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${rejected ? "bg-gray-200 text-gray-500" : STATUS_COLORS[book.status] ?? "bg-gray-100 text-gray-600"}`}>
            {book.status}
          </span>
          <br />
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${rejected ? "bg-gray-200 text-gray-500" : MOD_COLORS[book.moderationStatus] ?? "bg-gray-100 text-gray-600"}`}>
            {book.moderationStatus}
          </span>
          {pendingRepublish && (
            <>
              <br />
              <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700" title="Автор надіслав зміни в опублікованій книзі">
                ⏳ Зміни на модерації
              </span>
            </>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        {(() => {
          // One line per lifecycle timestamp that actually happened to this
          // book, most-recent-relevant kept alongside the submission dates --
          // covers submit/resubmit (existing), and now also затвердження
          // (moderationStatus APPROVED), публікація (status PUBLISHED), and
          // відхилення (status DRAFT after a reject), each keyed off the
          // status/moderationStatus that's actually showing in the cell
          // next to this one, so the date always matches what's displayed.
          const entries: { key: string; icon: string; title: string; date: string; className?: string }[] = [];
          if (book.publicationTimeline?.submitted) {
            entries.push({ key: "submitted", icon: "🕓", title: "Вперше надіслано на модерацію", date: book.publicationTimeline.submitted });
          }
          if (book.publicationTimeline?.lastSubmitted && book.publicationTimeline.lastSubmitted !== book.publicationTimeline?.submitted) {
            entries.push({
              key: "lastSubmitted",
              icon: "↻",
              title: "Востаннє повторно надіслано на модерацію",
              date: book.publicationTimeline.lastSubmitted,
              className: rejected ? "" : "text-blue-600",
            });
          }
          if (book.moderationStatus === "APPROVED" && book.publicationTimeline?.review_done) {
            entries.push({
              key: "approved",
              icon: "✅",
              title: "Дата затвердження адміном",
              date: book.publicationTimeline.review_done,
              className: rejected ? "" : "text-green-600",
            });
          }
          if (book.status === "PUBLISHED" && book.publishedAt) {
            entries.push({
              key: "published",
              icon: "📚",
              title: "Дата публікації в магазині",
              date: book.publishedAt,
              className: rejected ? "" : "text-green-700",
            });
          }
          if (book.status === "DRAFT" && book.moderationStatus === "REJECTED" && book.rejectedAt) {
            entries.push({
              key: "rejected",
              icon: "↩",
              title: "Дата відхилення адміном",
              date: book.rejectedAt,
              className: rejected ? "" : "text-red-600",
            });
          }
          if (entries.length === 0) return <span className="text-xs text-gray-300">—</span>;

          // Grouped by calendar date -- the date printed once per group,
          // followed by one compact "icon time" chip per event that day,
          // instead of the full date+time repeated on every line. Most rows
          // only ever have one date group (everything happened same-day),
          // collapsing 3-4 lines down to 2.
          const groups: { dateKey: string; items: typeof entries }[] = [];
          for (const e of entries) {
            const dateKey = formatDateOnly(e.date);
            const g = groups.find((g) => g.dateKey === dateKey);
            if (g) g.items.push(e);
            else groups.push({ dateKey, items: [e] });
          }

          return (
            <div className={`space-y-1 text-xs ${rejected ? "text-gray-400" : "text-gray-600"}`}>
              {groups.map((g) => (
                <div key={g.dateKey}>
                  <p className="font-medium">{g.dateKey}</p>
                  <p className="flex flex-wrap gap-x-1.5">
                    {g.items.map((e) => (
                      <span key={e.key} title={`${e.title} — ${formatDateTime(e.date)}`} className={e.className}>
                        {e.icon} {formatTimeOnly(e.date)}
                      </span>
                    ))}
                  </p>
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
        <div className="flex gap-2 text-xs font-medium">
          <span className={rejected ? "text-gray-400" : EXT_COLORS[book.d2dStatus]} title="D2D">
            {EXT_ICONS[book.d2dStatus]} D2D
          </span>
          <span className={rejected ? "text-gray-400" : EXT_COLORS[book.kdpStatus]} title="KDP">
            {EXT_ICONS[book.kdpStatus]} KDP
          </span>
          <span className={rejected ? "text-gray-400" : EXT_COLORS[book.googleStatus]} title="Google">
            {EXT_ICONS[book.googleStatus]} G
          </span>
        </div>
      </td>
      {/* Дії split into one column per action TYPE (not per row) so the same
          kind of action always lands in the same column across every book --
          scannable at a glance instead of hunting a crowded single cell. */}
      <td className="px-4 py-3">
        <div className="flex flex-col items-start gap-1">
          {pendingRepublish && (
            <button
              onClick={() => onApproveRepublish(book.id)}
              disabled={actionLoading === book.id + "_approveRepublish"}
              className="rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              ✓ Схвалити зміни
            </button>
          )}
          {book.status === "PUBLISHED" ? (
            <span className="rounded-md border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
              ✓ Опубліковано
            </span>
          ) : book.moderationStatus === "APPROVED" ? (
            <span className="rounded-md border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
              ✓ Схвалено
            </span>
          ) : (
            (book.status === "REVIEW" || book.moderationStatus === "PENDING") && (
              <button
                onClick={() => onApprove(book.id)}
                disabled={actionLoading === book.id + "_approve"}
                title="Схвалює перевірку і одразу публікує книгу на Ulit (ISBN + статус Опубліковано)"
                className="rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                ✓ Схвалити й опублікувати
              </button>
            )
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col items-start gap-1">
          {pendingRepublish && (
            <button
              onClick={() => onRejectRepublish(book.id)}
              disabled={actionLoading === book.id + "_rejectRepublish"}
              className="rounded-md bg-red-50 border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              ✕ Відхилити зміни
            </button>
          )}
          {book.status !== "DRAFT" && (
            <button
              onClick={() => onRejectClick(book.id)}
              className="rounded-md bg-red-50 border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
            >
              ✕ Відхилити
            </button>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        {(book.status === "PUBLISHED" || book.moderationStatus === "APPROVED") && (
          <Link
            href={`/admin/books/${book.id}/distribute`}
            className="rounded-md bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
          >
            {book.status === "PUBLISHED" ? "📦 Розіслати" : "📦 Публікація"}
          </Link>
        )}
      </td>
      <td className="px-4 py-3">
        <button
          onClick={() => onFilesClick(book)}
          className="rounded-md border px-2.5 py-1 text-xs font-medium text-gray-500 hover:bg-gray-50"
          title="Завантажити файли"
        >
          📁 Файли
        </button>
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
    const next = Math.max(MIN_COLUMN_WIDTH, r.startWidth + (e.clientX - r.startX));
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
                    <td colSpan={9} className="px-4 py-2">
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

"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useApi } from "../../../hooks/useApi";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

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
  distributionStrategy?: string;
  d2dStatus: string;
  kdpStatus: string;
  googleStatus: string;
  priceEbook?: string | null;
  pricePrint?: string | null;
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

function Checklist({ book }: { book: Book }) {
  const checks = [
    { label: "Обкладинка", ok: !!book.coverUrl },
    { label: "EPUB", ok: !!book.epubUrl },
    { label: "ISBN", ok: !!book.isbn },
    { label: "Ціна", ok: !!(book.priceEbook || book.pricePrint) },
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

export default function AdminBooksPage() {
  const searchParams = useSearchParams();
  const { apiFetch } = useApi();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "");
  const [modFilter, setModFilter] = useState(searchParams.get("mod") ?? "");
  const [search, setSearch] = useState("");

  const fetchBooks = useCallback(async () => {
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
  }, [statusFilter, modFilter, search]);

  useEffect(() => { fetchBooks(); }, [fetchBooks]);

  async function handleApprove(id: string) {
    setActionLoading(id + "_approve");
    try {
      await apiFetch(`/api/admin/books/${id}/approve`, { method: "PATCH" });
      await fetchBooks();
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
    } finally {
      setActionLoading(null);
    }
  }

  async function handleExport(id: string) {
    const session = (window as any).__NEXT_SESSION_TOKEN;
    const tokenKey = "apiToken";
    // Get token from sessionStorage/localStorage as used by useApi
    const token = (document as any).__nextAuthToken;
    const apiUrl = API_URL;
    // Fallback: open the URL (browser will prompt download if authenticated via cookie)
    window.open(`${apiUrl}/api/admin/books/${id}/export-package`, "_blank");
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
          {["DRAFT", "PROCESSING", "REVIEW", "PUBLISHED", "ARCHIVED"].map((s) => (
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
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Книга</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Статус</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Чеклист</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">D2D / KDP / Google</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Дії</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {books.map((book) => (
                  <tr key={book.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        {book.coverUrl ? (
                          <img src={book.coverUrl} alt="" className="h-12 w-8 rounded object-cover shrink-0" />
                        ) : (
                          <div className="h-12 w-8 rounded bg-gray-100 flex items-center justify-center text-lg shrink-0">📖</div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate max-w-xs">{book.title}</p>
                          <p className="text-xs text-gray-500">{book.author.name}</p>
                          {book.isbn && <p className="text-xs font-mono text-gray-400">{book.isbn}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[book.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {book.status}
                        </span>
                        <br />
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${MOD_COLORS[book.moderationStatus] ?? "bg-gray-100 text-gray-600"}`}>
                          {book.moderationStatus}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Checklist book={book} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 text-xs font-medium">
                        <span className={EXT_COLORS[book.d2dStatus]} title="D2D">
                          {EXT_ICONS[book.d2dStatus]} D2D
                        </span>
                        <span className={EXT_COLORS[book.kdpStatus]} title="KDP">
                          {EXT_ICONS[book.kdpStatus]} KDP
                        </span>
                        <span className={EXT_COLORS[book.googleStatus]} title="Google">
                          {EXT_ICONS[book.googleStatus]} G
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2 flex-wrap">
                        {(book.status === "REVIEW" || book.moderationStatus === "PENDING") && (
                          <button
                            onClick={() => handleApprove(book.id)}
                            disabled={actionLoading === book.id + "_approve"}
                            className="rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            ✓ Схвалити
                          </button>
                        )}
                        {book.status !== "DRAFT" && (
                          <button
                            onClick={() => setRejectId(book.id)}
                            className="rounded-md bg-red-50 border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                          >
                            ✕ Відхилити
                          </button>
                        )}
                        {book.status === "PUBLISHED" && (
                          <Link
                            href={`/admin/books/${book.id}/distribute`}
                            className="rounded-md bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                          >
                            📦 Розіслати
                          </Link>
                        )}
                        <button
                          onClick={() => handleExport(book.id)}
                          className="rounded-md border px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                          title="Завантажити ZIP"
                        >
                          ⬇ ZIP
                        </button>
                      </div>
                    </td>
                  </tr>
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
    </div>
  );
}

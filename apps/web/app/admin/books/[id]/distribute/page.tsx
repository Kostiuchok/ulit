"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useApi } from "../../../../../hooks/useApi";

interface Book {
  id: string;
  title: string;
  isbn?: string | null;
  coverUrl?: string | null;
  epubUrl?: string | null;
  fb2Url?: string | null;
  mobiUrl?: string | null;
  printPdfUrl?: string | null;
  priceEbook?: string | null;
  pricePrint?: string | null;
  genre?: string | null;
  language?: string;
  distributionStrategy: string;
  d2dStatus: string;
  d2dSentAt?: string | null;
  kdpStatus: string;
  kdpSentAt?: string | null;
  googleStatus: string;
  googleSentAt?: string | null;
  moderationStatus: string;
  author: { name: string; email: string };
}

const STATUS_OPTS = ["NOT_SENT", "SENT", "PUBLISHED", "ERROR"] as const;
const STATUS_COLORS: Record<string, string> = {
  NOT_SENT: "bg-gray-100 text-gray-600",
  SENT: "bg-blue-100 text-blue-700",
  PUBLISHED: "bg-green-100 text-green-700",
  ERROR: "bg-red-100 text-red-700",
};

export default function DistributePage() {
  const { id } = useParams<{ id: string }>();
  const { apiFetch } = useApi();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [d2d, setD2d] = useState("NOT_SENT");
  const [kdp, setKdp] = useState("NOT_SENT");
  const [google, setGoogle] = useState("NOT_SENT");

  useEffect(() => {
    apiFetch<{ book: Book }>(`/api/admin/books/${id}`)
      .then(({ book: b }) => {
        setBook(b);
        setD2d(b.d2dStatus);
        setKdp(b.kdpStatus);
        setGoogle(b.googleStatus);
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function saveService(service: "d2d" | "kdp" | "google", status: string) {
    setSaving(service);
    try {
      const field = `${service}Status`;
      const sentAtField = `${service}SentAt`;
      const { book: updated } = await apiFetch<{ book: Book }>(
        `/api/admin/books/${id}/distribution`,
        {
          method: "PATCH",
          body: JSON.stringify({
            [field]: status,
            [sentAtField]: status === "SENT" ? new Date().toISOString() : null,
          }),
        }
      );
      setBook(updated);
      if (service === "d2d") setD2d(updated.d2dStatus);
      if (service === "kdp") setKdp(updated.kdpStatus);
      if (service === "google") setGoogle(updated.googleStatus);
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return <div className="animate-pulse text-gray-400 p-8">Завантаження…</div>;
  }
  if (!book) return null;

  const isKdpSelect = book.distributionStrategy === "KDP_SELECT";

  const checks = [
    { label: "Обкладинка", ok: !!book.coverUrl, icon: "🖼" },
    { label: "EPUB", ok: !!book.epubUrl, icon: "📖" },
    { label: "FB2", ok: !!book.fb2Url, icon: "📄" },
    { label: "MOBI", ok: !!book.mobiUrl, icon: "📱" },
    { label: "Print PDF", ok: !!book.printPdfUrl, icon: "🖨" },
    { label: "ISBN", ok: !!book.isbn, icon: "🔢" },
    { label: "Ціна", ok: !!(book.priceEbook || book.pricePrint), icon: "💰" },
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/admin/books" className="text-sm text-gray-500 hover:text-gray-700">
          ← Книги
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900 truncate">{book.title}</h1>
      </div>

      {/* Book info */}
      <div className="rounded-xl border bg-white p-5 shadow-sm flex gap-4">
        {book.coverUrl ? (
          <img src={book.coverUrl} alt="" className="h-28 w-20 rounded-lg object-cover shrink-0" />
        ) : (
          <div className="h-28 w-20 rounded-lg bg-gray-100 flex items-center justify-center text-3xl shrink-0">📖</div>
        )}
        <div className="space-y-1">
          <p className="font-semibold text-gray-900">{book.title}</p>
          <p className="text-sm text-gray-500">Автор: {book.author.name} ({book.author.email})</p>
          {book.isbn && <p className="text-sm font-mono text-gray-700">ISBN: {book.isbn}</p>}
          <p className="text-sm text-gray-500">Стратегія: <strong>{book.distributionStrategy}</strong></p>
          {isKdpSelect && (
            <span className="inline-block rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700">
              ⚠️ KDP Select — тільки Amazon 90 днів
            </span>
          )}
        </div>
      </div>

      {/* Readiness checklist */}
      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Чеклист готовності</h2>
        <div className="grid grid-cols-2 gap-2">
          {checks.map((c) => (
            <div key={c.label} className={`flex items-center gap-2 rounded-lg p-2.5 ${c.ok ? "bg-green-50 border border-green-100" : "bg-gray-50 border"}`}>
              <span className={`text-base ${c.ok ? "opacity-100" : "opacity-30"}`}>{c.icon}</span>
              <span className={`text-xs font-medium ${c.ok ? "text-green-800" : "text-gray-400"}`}>{c.label}</span>
              <span className={`ml-auto text-xs font-bold ${c.ok ? "text-green-600" : "text-gray-300"}`}>{c.ok ? "✓" : "○"}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Distribution services */}
      <div className="space-y-4">
        {/* D2D */}
        {!isKdpSelect && (
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Draft2Digital (D2D)</h2>
                <p className="text-xs text-gray-500">Apple Books, B&N, Kobo, Scribd та інші</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[d2d]}`}>{d2d}</span>
            </div>
            {book.d2dSentAt && <p className="text-xs text-gray-400 mb-3">Відправлено: {new Date(book.d2dSentAt).toLocaleString("uk-UA")}</p>}
            <div className="flex gap-2">
              {STATUS_OPTS.map((s) => (
                <button
                  key={s}
                  onClick={() => saveService("d2d", s)}
                  disabled={saving === "d2d" || d2d === s}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                    d2d === s ? "bg-gray-900 text-white" : "border hover:bg-gray-50"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* KDP */}
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Amazon KDP</h2>
              <p className="text-xs text-gray-500">Kindle Direct Publishing</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[kdp]}`}>{kdp}</span>
          </div>
          {book.kdpSentAt && <p className="text-xs text-gray-400 mb-3">Відправлено: {new Date(book.kdpSentAt).toLocaleString("uk-UA")}</p>}
          <div className="flex gap-2">
            {STATUS_OPTS.map((s) => (
              <button
                key={s}
                onClick={() => saveService("kdp", s)}
                disabled={saving === "kdp" || kdp === s}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                  kdp === s ? "bg-gray-900 text-white" : "border hover:bg-gray-50"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Google */}
        {!isKdpSelect && (
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Google Play Books</h2>
                <p className="text-xs text-gray-500">Google Books Partner Program</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[google]}`}>{google}</span>
            </div>
            {book.googleSentAt && <p className="text-xs text-gray-400 mb-3">Відправлено: {new Date(book.googleSentAt).toLocaleString("uk-UA")}</p>}
            <div className="flex gap-2">
              {STATUS_OPTS.map((s) => (
                <button
                  key={s}
                  onClick={() => saveService("google", s)}
                  disabled={saving === "google" || google === s}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                    google === s ? "bg-gray-900 text-white" : "border hover:bg-gray-50"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

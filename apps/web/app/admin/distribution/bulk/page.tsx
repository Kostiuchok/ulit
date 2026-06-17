"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApi } from "../../../../hooks/useApi";

interface Book {
  id: string;
  title: string;
  isbn?: string | null;
  coverUrl?: string | null;
  author: { name: string };
}

export default function BulkExportPage() {
  const searchParams = useSearchParams();
  const { apiFetch, token } = useApi();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const preselectedIds = searchParams.get("ids")?.split(",").filter(Boolean) ?? [];

  useEffect(() => {
    if (!token) return;
    apiFetch<{ books: Book[] }>("/api/admin/distribution/queue")
      .then((d) => {
        setBooks(d.books);
        setSelected(new Set(preselectedIds.length ? preselectedIds : d.books.map((b) => b.id)));
      })
      .finally(() => setLoading(false));
  }, [token]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleExport() {
    if (!selected.size) return;
    setExporting(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const session = (window as any).__nextAuthSession;
      const token = session?.apiToken;

      const res = await fetch(`${apiUrl}/api/admin/distribution/bulk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ bookIds: Array.from(selected) }),
      });

      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "knyha-bulk.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.message || "Помилка експорту");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Масова відправка</h1>
        <p className="text-sm text-gray-500 mt-1">
          Завантажте ZIP-архів з усіма вибраними книгами для відправки на сервіси розподілу.
        </p>
      </div>

      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 animate-pulse">Завантаження…</div>
        ) : (
          <>
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">
                Обрано: {selected.size} / {books.length} книг
              </p>
              <button
                onClick={() =>
                  selected.size === books.length
                    ? setSelected(new Set())
                    : setSelected(new Set(books.map((b) => b.id)))
                }
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                {selected.size === books.length ? "Скасувати все" : "Вибрати все"}
              </button>
            </div>

            <div className="divide-y">
              {books.map((book) => (
                <label
                  key={book.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(book.id)}
                    onChange={() => toggle(book.id)}
                    className="h-4 w-4"
                  />
                  {book.coverUrl ? (
                    <img src={book.coverUrl} alt="" className="h-10 w-7 rounded object-cover shrink-0" />
                  ) : (
                    <div className="h-10 w-7 rounded bg-gray-100 flex items-center justify-center text-sm shrink-0">📖</div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900">{book.title}</p>
                    <p className="text-xs text-gray-500">{book.author.name}</p>
                  </div>
                  {book.isbn && (
                    <p className="ml-auto text-xs font-mono text-gray-400">{book.isbn}</p>
                  )}
                </label>
              ))}

              {books.length === 0 && (
                <div className="p-8 text-center text-gray-400">Черга порожня</div>
              )}
            </div>
          </>
        )}
      </div>

      <button
        onClick={handleExport}
        disabled={!selected.size || exporting}
        className="w-full rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
      >
        {exporting ? "Формування ZIP…" : `⬇ Завантажити ZIP (${selected.size} книг)`}
      </button>
    </div>
  );
}

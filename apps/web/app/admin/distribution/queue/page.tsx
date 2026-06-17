"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useApi } from "../../../../hooks/useApi";

interface Book {
  id: string;
  title: string;
  isbn?: string | null;
  coverUrl?: string | null;
  distributionStrategy: string;
  d2dStatus: string;
  kdpStatus: string;
  googleStatus: string;
  publishedAt?: string | null;
  author: { name: string };
}

export default function DistributionQueuePage() {
  const { apiFetch, token } = useApi();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!token) return;
    apiFetch<{ books: Book[] }>("/api/admin/distribution/queue")
      .then((d) => setBooks(d.books))
      .finally(() => setLoading(false));
  }, [token]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === books.length) setSelected(new Set());
    else setSelected(new Set(books.map((b) => b.id)));
  }

  const isKdpOnly = (b: Book) => b.distributionStrategy === "KDP_SELECT";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Черга дистрибуції</h1>
          <p className="text-sm text-gray-500 mt-1">Книги готові до відправки на зовнішні сервіси</p>
        </div>
        {selected.size > 0 && (
          <Link
            href={`/admin/distribution/bulk?ids=${Array.from(selected).join(",")}`}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
          >
            📦 Масово ({selected.size})
          </Link>
        )}
      </div>

      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 animate-pulse">Завантаження…</div>
        ) : books.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-4xl mb-3">✅</p>
            <p className="text-gray-500">Черга порожня — всі книги розіслані</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3">
                  <input type="checkbox" checked={selected.size === books.length} onChange={toggleAll} />
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Книга</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Стратегія</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">D2D / KDP / Google</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Дії</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {books.map((book) => (
                <tr key={book.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(book.id)}
                      onChange={() => toggle(book.id)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {book.coverUrl ? (
                        <img src={book.coverUrl} alt="" className="h-10 w-7 rounded object-cover" />
                      ) : (
                        <div className="h-10 w-7 rounded bg-gray-100 flex items-center justify-center text-sm">📖</div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{book.title}</p>
                        <p className="text-xs text-gray-500">{book.author.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      isKdpOnly(book) ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
                    }`}>
                      {isKdpOnly(book) ? "KDP Select" : "Широке"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3 text-xs">
                      {!isKdpOnly(book) && (
                        <span className={book.d2dStatus === "NOT_SENT" ? "text-red-500 font-medium" : "text-gray-400"}>
                          D2D: {book.d2dStatus}
                        </span>
                      )}
                      <span className={book.kdpStatus === "NOT_SENT" ? "text-red-500 font-medium" : "text-gray-400"}>
                        KDP: {book.kdpStatus}
                      </span>
                      {!isKdpOnly(book) && (
                        <span className={book.googleStatus === "NOT_SENT" ? "text-red-500 font-medium" : "text-gray-400"}>
                          G: {book.googleStatus}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/books/${book.id}/distribute`}
                      className="rounded-md bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                    >
                      Розіслати →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

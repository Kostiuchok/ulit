"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BookCard } from "@/components/books/BookCard";
import { DeleteBookModal } from "@/components/books/DeleteBookModal";
import { PurgeArchivedModal } from "@/components/books/PurgeArchivedModal";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/useApi";

interface Book {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  status: string;
  moderationStatus?: string;
  d2dStatus?: string;
  kdpStatus?: string;
  googleStatus?: string;
  coverUrl?: string | null;
  priceEbook?: string | null;
  pricePrint?: string | null;
  pricePrintHardcover?: string | null;
  genre?: string | null;
  isbn?: string | null;
  pageCount?: number | null;
  printPageCount?: number | null;
  createdAt: string;
  publishedAt?: string | null;
  archivedAt?: string | null;
  publicationTimeline?: Record<string, string> | null;
}

// Rendered both under the book-management sidebar (/dashboard/books) and
// under the author profile tabs (/dashboard/settings/books) — the "Мої
// книги" profile tab needs the same content without leaving that layout,
// or the author loses the profile menu with no way back to it.
const FILTERS: Record<string, { label: string; test: (b: Book) => boolean }> = {
  published: { label: "Опубліковано", test: (b) => b.status === "PUBLISHED" },
  pending: { label: "На затвердженні адміном", test: (b) => b.status === "REVIEW" },
  distributed: {
    label: "На сторонніх сервісах",
    test: (b) => b.d2dStatus === "PUBLISHED" || b.kdpStatus === "PUBLISHED" || b.googleStatus === "PUBLISHED",
  },
  rejected: { label: "Повернуто на доопрацювання", test: (b) => b.moderationStatus === "REJECTED" },
};

export function MyBooksList() {
  const { apiFetch, token } = useApi();
  const searchParams = useSearchParams();
  const activeFilter = searchParams.get("filter");
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteBookId, setDeleteBookId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [purging, setPurging] = useState(false);
  const [purgeNotice, setPurgeNotice] = useState<string | null>(null);

  function load() {
    if (!token) return;
    setLoading(true);
    apiFetch<{ books: Book[] }>("/api/books?includeArchived=1")
      .then(({ books }) => {
        setBooks(books);
        setError(null);
      })
      .catch((e: any) => setError(e.message || "Не вдалося завантажити книги"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [token]);

  async function handleRestore(id: string) {
    setRestoring(id);
    try {
      const { book } = await apiFetch<{ book: Book }>(`/api/books/${id}/restore`, { method: "POST" });
      setBooks((prev) => prev.map((b) => (b.id === id ? book : b)));
    } catch (e: any) {
      alert(e.message || "Помилка відновлення");
    } finally {
      setRestoring(null);
    }
  }

  const activeStatusBooks = books.filter((b) => b.status !== "ARCHIVED");
  const filterDef = activeFilter ? FILTERS[activeFilter] : undefined;
  const activeBooks = filterDef ? activeStatusBooks.filter(filterDef.test) : activeStatusBooks;
  const archivedBooks = books.filter((b) => b.status === "ARCHIVED");

  return (
    <div className="p-8">
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Мої книги</h1>
            {!loading && (
              <p className="text-sm text-gray-500 mt-0.5">
                {activeBooks.length === 0 ? "Ще немає книг" : `${activeBooks.length} книг`}
              </p>
            )}
          </div>
          <Link href="/dashboard/books/new">
            <Button>+ Нова книга</Button>
          </Link>
        </div>

        {filterDef && (
          <div className="mb-6 flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm">
            <span>
              Фільтр: <strong>{filterDef.label}</strong>
            </span>
            <Link href="/dashboard/books" className="text-gray-500 underline hover:text-gray-700">
              Скинути фільтр
            </Link>
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 rounded-xl border bg-white animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 py-16 text-center">
            <p className="text-red-700">Не вдалося завантажити книги</p>
            <p className="mt-1 text-[0.75rem] text-red-500">{error}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={load}>
              Спробувати ще раз
            </Button>
          </div>
        ) : activeBooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-white py-20 text-center">
            <div className="text-5xl mb-4">📚</div>
            <h2 className="text-lg font-semibold text-gray-700">Поки немає книг</h2>
            <p className="mt-1 text-sm text-gray-500">Опублікуйте свою першу книгу на платформі Knyha</p>
            <Link href="/dashboard/books/new" className="mt-6">
              <Button>Опублікувати книгу</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {activeBooks.map((book) => (
              <BookCard key={book.id} book={book} onDelete={setDeleteBookId} />
            ))}
          </div>
        )}

        {purgeNotice && (
          <div className="mt-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {purgeNotice}
          </div>
        )}

        {archivedBooks.length > 0 && (
          <div className="mt-10">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-500">Видалені книги</h2>
              <button
                type="button"
                onClick={() => setPurging(true)}
                className="text-xs font-medium text-red-600 hover:text-red-700"
              >
                Очистити список
              </button>
            </div>
            <div className="space-y-2">
              {archivedBooks.map((book) => (
                <div
                  key={book.id}
                  className="flex items-center justify-between rounded-lg border border-dashed bg-gray-50 px-4 py-3"
                >
                  <span className="truncate text-sm text-gray-500">{book.title}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    loading={restoring === book.id}
                    onClick={() => handleRestore(book.id)}
                  >
                    Відновити
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {deleteBookId && (
        <DeleteBookModal
          bookId={deleteBookId}
          onClose={() => setDeleteBookId(null)}
          onDeleted={() => {
            setDeleteBookId(null);
            load();
          }}
        />
      )}

      {purging && (
        <PurgeArchivedModal
          count={archivedBooks.length}
          onClose={() => setPurging(false)}
          onPurged={({ purged, skipped }) => {
            setPurging(false);
            setPurgeNotice(
              skipped.length === 0
                ? `Видалено остаточно: ${purged.length}.`
                : `Видалено остаточно: ${purged.length}. Пропущено (є замовлення): ${skipped
                    .map((b) => b.title)
                    .join(", ")}.`
            );
            load();
          }}
        />
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookCard } from "@/components/books/BookCard";
import { DeleteBookModal } from "@/components/books/DeleteBookModal";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/useApi";

interface Book {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  status: string;
  coverUrl?: string | null;
  priceEbook?: string | null;
  pricePrint?: string | null;
  pricePrintHardcover?: string | null;
  genre?: string | null;
  isbn?: string | null;
  createdAt: string;
  publishedAt?: string | null;
  archivedAt?: string | null;
  publicationTimeline?: Record<string, string> | null;
}

export default function BooksPage() {
  const { apiFetch, token } = useApi();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteBookId, setDeleteBookId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);

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

  const activeBooks = books.filter((b) => b.status !== "ARCHIVED");
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

        {archivedBooks.length > 0 && (
          <div className="mt-10">
            <h2 className="mb-3 text-base font-semibold text-gray-500">Видалені книги</h2>
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
    </div>
  );
}

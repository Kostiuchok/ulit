"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookCard } from "../../../components/books/BookCard";
import { Button } from "../../../components/ui/button";
import { useApi } from "../../../hooks/useApi";

interface Book {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  status: string;
  coverUrl?: string | null;
  priceEbook?: string | null;
  pricePrint?: string | null;
  genre?: string | null;
  isbn?: string | null;
  createdAt: string;
  publishedAt?: string | null;
}

export default function BooksPage() {
  const { apiFetch, token } = useApi();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    apiFetch<{ books: Book[] }>("/api/books")
      .then(({ books }) => setBooks(books))
      .catch((e) => console.error("[books] failed to load:", e))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleDelete(id: string) {
    if (!confirm("Видалити книгу? Цю дію не можна скасувати.")) return;
    setDeleting(id);
    try {
      await apiFetch(`/api/books/${id}`, { method: "DELETE" });
      setBooks((prev) => prev.filter((b) => b.id !== id));
    } catch (e: any) {
      alert(e.message || "Помилка видалення");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Мої книги</h1>
            {!loading && (
              <p className="text-sm text-gray-500 mt-0.5">
                {books.length === 0 ? "Ще немає книг" : `${books.length} книг`}
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
        ) : books.length === 0 ? (
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
            {books.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                onDelete={deleting ? undefined : handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

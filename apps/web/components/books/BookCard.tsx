"use client";

import Link from "next/link";
import { cn } from "../../lib/utils";

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

const statusConfig: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Чернетка", className: "bg-gray-100 text-gray-600" },
  PROCESSING: { label: "Обробка", className: "bg-blue-100 text-blue-700" },
  REVIEW: { label: "На перевірці", className: "bg-yellow-100 text-yellow-700" },
  PUBLISHED: { label: "Опубліковано", className: "bg-green-100 text-green-700" },
  ARCHIVED: { label: "Архів", className: "bg-gray-100 text-gray-500" },
};

interface Props {
  book: Book;
  onDelete?: (id: string) => void;
}

export function BookCard({ book, onDelete }: Props) {
  const status = statusConfig[book.status] ?? statusConfig.DRAFT;

  return (
    <div className="group relative flex gap-4 rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md">
      {/* Cover */}
      <div className="flex-shrink-0">
        {book.coverUrl ? (
          <img
            src={book.coverUrl}
            alt={book.title}
            className="h-32 w-24 rounded-md object-cover"
          />
        ) : (
          <div className="flex h-32 w-24 items-center justify-center rounded-md bg-gray-100 text-3xl">
            📖
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col justify-between min-w-0">
        <div>
          <div className="flex items-start justify-between gap-2">
            <Link
              href={`/dashboard/books/${book.id}`}
              className="font-semibold text-gray-900 hover:underline truncate"
            >
              {book.title}
            </Link>
            <span className={cn("flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium", status.className)}>
              {status.label}
            </span>
          </div>

          {book.genre && <p className="mt-0.5 text-xs text-gray-400">{book.genre}</p>}

          {book.description && (
            <p className="mt-1.5 text-sm text-gray-600 line-clamp-2">{book.description}</p>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-gray-500">
            {book.priceEbook && <span>Е-книга: {Number(book.priceEbook).toFixed(0)} грн</span>}
            {book.pricePrint && <span>Друк: {Number(book.pricePrint).toFixed(0)} грн</span>}
            {book.isbn && <span>ISBN: {book.isbn}</span>}
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/books/${book.id}`}
              className="rounded-md px-3 py-1 text-xs font-medium border hover:bg-gray-50"
            >
              Редагувати
            </Link>
            {onDelete && book.status !== "PUBLISHED" && (
              <button
                onClick={() => onDelete(book.id)}
                className="rounded-md px-3 py-1 text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50"
              >
                Видалити
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

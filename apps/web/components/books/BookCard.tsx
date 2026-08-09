"use client";

import Link from "next/link";
import { cn } from "../../lib/utils";
import { BOOK_STATUS_LABELS } from "../../lib/bookStatus";

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

interface Props {
  book: Book;
  onDelete?: (id: string) => void;
}

export function BookCard({ book, onDelete }: Props) {
  const status = BOOK_STATUS_LABELS[book.status] ?? BOOK_STATUS_LABELS.DRAFT;

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
            <Link href={`/dashboard/books/${book.id}`} className="min-w-0 hover:underline">
              <h2 className="truncate">{book.title}</h2>
            </Link>
            <span className={cn("flex-shrink-0 rounded-full px-2.5 py-0.5 text-[0.8125rem] font-medium", status.className)}>
              {status.label}
            </span>
          </div>

          {book.genre && <h3 className="mt-0.5 font-normal text-gray-500">{book.genre}</h3>}

          {book.description && (
            <h3 className="mt-1.5 font-normal text-gray-600 line-clamp-2">{book.description}</h3>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-3 text-[0.75rem] text-gray-500">
            {book.priceEbook && <span>Е-книга: {Number(book.priceEbook).toFixed(0)} грн</span>}
            {book.pricePrint && <span>Друк: {Number(book.pricePrint).toFixed(0)} грн</span>}
            {book.isbn && <span>ISBN: {book.isbn}</span>}
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/books/${book.id}`}
              className="rounded-md px-3 py-1 text-sm font-medium border hover:bg-gray-50"
            >
              Редагувати
            </Link>
            {onDelete && book.status !== "PUBLISHED" && (
              <button
                onClick={() => onDelete(book.id)}
                className="rounded-md px-3 py-1 text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50"
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

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useApi } from "../../../../../hooks/useApi";

interface BookInfo {
  id: string;
  title: string;
  isbn: string | null;
  slug: string;
  coverUrl: string | null;
  priceEbook: string | null;
  pricePrint: string | null;
  pdfUrl: string | null;
  epubUrl: string | null;
  fb2Url: string | null;
  mobiUrl: string | null;
  printPdfUrl: string | null;
  distributionStrategy: string;
  publishedAt: string | null;
}

const FORMAT_LABELS: Record<string, string> = {
  pdfUrl: "PDF (онлайн)",
  epubUrl: "EPUB",
  fb2Url: "FB2",
  mobiUrl: "MOBI / AZW3",
  printPdfUrl: "PDF (друк)",
};

export default function PublishedPage() {
  const { id } = useParams<{ id: string }>();
  const { apiFetch } = useApi();
  const [book, setBook] = useState<BookInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ book: BookInfo }>(`/api/books/${id}`)
      .then(({ book }) => setBook(book))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="p-8 max-w-2xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-gray-200 animate-pulse rounded" />
        <div className="h-64 bg-gray-200 animate-pulse rounded-xl" />
      </div>
    );
  }

  const availableFormats = book
    ? Object.entries(FORMAT_LABELS).filter(([key]) => book[key as keyof BookInfo])
    : [];

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        {/* Success header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-3xl font-bold text-gray-900">Книгу опубліковано!</h1>
          <p className="mt-2 text-gray-500">Вашу книгу успішно опубліковано на платформі Knyha.</p>
        </div>

        <div className="rounded-xl border bg-white p-6 shadow-sm space-y-6">
          {/* Cover + title */}
          <div className="flex items-start gap-4">
            {book?.coverUrl ? (
              <img src={book.coverUrl} alt={book?.title} className="h-32 w-24 rounded-md object-cover shadow" />
            ) : (
              <div className="flex h-32 w-24 items-center justify-center rounded-md bg-gray-100 text-3xl">📖</div>
            )}
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{book?.title}</h2>
              {book?.publishedAt && (
                <p className="text-sm text-gray-500 mt-1">
                  Опубліковано {new Date(book.publishedAt).toLocaleDateString("uk-UA", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              )}
              <span className="mt-2 inline-block rounded-full bg-green-100 px-3 py-0.5 text-xs font-medium text-green-700">
                ✓ Опубліковано
              </span>
            </div>
          </div>

          {/* ISBN */}
          {book?.isbn && (
            <div className="rounded-lg bg-gray-50 border p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">ISBN</p>
              <p className="text-2xl font-mono font-bold text-gray-900 tracking-wider">{book.isbn}</p>
              <p className="text-xs text-gray-400 mt-1">Міжнародний стандартний номер книги</p>
            </div>
          )}

          {/* Formats */}
          {availableFormats.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Доступні формати</p>
              <div className="flex flex-wrap gap-2">
                {availableFormats.map(([key, label]) => (
                  <span key={key} className="rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-medium text-blue-700">
                    ✓ {label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Pricing */}
          <div className="grid grid-cols-2 gap-4">
            {book?.priceEbook && (
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-gray-500">Е-книга</p>
                <p className="text-xl font-bold text-gray-900">{Number(book.priceEbook).toFixed(2)} грн</p>
              </div>
            )}
            {book?.pricePrint && (
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-gray-500">Друкована</p>
                <p className="text-xl font-bold text-gray-900">{Number(book.pricePrint).toFixed(2)} грн</p>
              </div>
            )}
          </div>

          {/* Distribution */}
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            {book?.distributionStrategy === "KDP_SELECT" ? (
              <>🔶 <strong>KDP Select</strong> — книга ексклюзивно доступна на Amazon Kindle 90 днів.</>
            ) : (
              <>🌐 <strong>Широке розповсюдження</strong> — книга буде надіслана до Draft2Digital та Google Play Books.</>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-wrap gap-3 justify-center">
          <Link href="/dashboard/books" className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            ← Мої книги
          </Link>
          <Link href={`/dashboard/books/${id}`} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Сторінка книги
          </Link>
          <Link href="/dashboard/books/new" className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
            + Опублікувати ще одну
          </Link>
        </div>
      </div>
    </div>
  );
}

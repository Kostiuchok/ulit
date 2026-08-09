"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { PublicationTimeline } from "@/components/books/PublicationTimeline";
import { PublishButton } from "@/components/books/PublishButton";
import { TabletCoverFrame } from "@/components/books/TabletCoverFrame";
import { useBook } from "@/hooks/useBook";

interface DashboardBook {
  status: string;
  title: string;
  slug: string;
  coverUrl?: string | null;
  priceEbook?: string | number | null;
  pricePrint?: string | number | null;
  pricePrintHardcover?: string | number | null;
  genre?: string | null;
  originalDocxUrl?: string | null;
  manuscriptImportedAt?: string | null;
  manuscriptEditedAt?: string | null;
  pdfUrl?: string | null;
  createdAt: string;
  publicationTimeline?: any;
  isbn?: string | null;
  distributionChannels?: string[] | null;
  distributionStrategy?: string;
  kdpSelectEnrolled?: boolean;
  kdpSelectExpiry?: string | null;
  d2dStatus: string;
  d2dSentAt?: string | null;
  kdpStatus: string;
  kdpSentAt?: string | null;
  googleStatus: string;
  googleSentAt?: string | null;
  moderationStatus?: string | null;
  moderationNote?: string | null;
}

export function BookDashboard() {
  const { id } = useParams<{ id: string }>();
  const { book, setBook, loading } = useBook<DashboardBook>(id);

  if (loading) {
    return (
      <div className="p-8">
        <div className="h-96 bg-gray-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  const isPublished = book?.status === "PUBLISHED";

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="space-y-8">
        {book?.moderationStatus === "REJECTED" && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-red-600 text-lg">✕</span>
              <p className="font-semibold text-red-800">Книгу відхилено модератором</p>
            </div>
            {book.moderationNote ? (
              <p className="text-sm text-red-700 whitespace-pre-wrap">{book.moderationNote}</p>
            ) : (
              <p className="text-sm text-red-600">Причину не вказано. Зверніться до підтримки.</p>
            )}
            <p className="text-xs text-red-500">
              Виправте зазначені недоліки та надішліть книгу на публікацію повторно.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[1.4375rem] font-bold text-black">{book?.title}</h1>
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href={`/dashboard/books/${id}/output-data`}
              className="rounded-md border border-black px-4 py-2 text-sm text-black hover:bg-gray-50"
            >
              Редагувати
            </Link>
            {isPublished ? (
              <button
                disabled
                title="Скоро — повторна публікація змін"
                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-300 cursor-not-allowed"
              >
                Опублікувати із змінами
              </button>
            ) : (
              <PublishButton
                bookId={id}
                bookStatus={book?.status ?? "DRAFT"}
                onPublished={() => setBook((b) => (b ? { ...b, status: "PUBLISHED" } : b))}
              />
            )}
            {isPublished ? (
              <a
                href={`/books/${book.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-black px-4 py-2 text-sm text-black hover:bg-gray-50"
              >
                Сайт книги
              </a>
            ) : (
              <span
                title="Доступно після публікації"
                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-300 cursor-not-allowed"
              >
                Сайт книги
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr]">
          {/* Left: cover + price */}
          <div className="space-y-4">
            <TabletCoverFrame coverUrl={book?.coverUrl} />

            {(book?.priceEbook || book?.pricePrint || book?.pricePrintHardcover) && (
              <div className="rounded-md border bg-white p-4 shadow-sm space-y-3">
                <div className="space-y-1 text-sm text-black">
                  {book?.priceEbook && <p>Електронна - {Number(book.priceEbook).toFixed(0)} грн</p>}
                  {book?.pricePrint && <p>Друк, м'яка - {Number(book.pricePrint).toFixed(0)} грн</p>}
                  {book?.pricePrintHardcover && <p>Друк, тверда - {Number(book.pricePrintHardcover).toFixed(0)} грн</p>}
                </div>
                <Link
                  href={`/dashboard/books/${id}/output-data`}
                  className="block w-full rounded-md border border-black py-2 text-center text-sm text-black hover:bg-gray-50"
                >
                  Змінити ціну
                </Link>
              </div>
            )}
          </div>

          {/* Right: timeline + distribution + publish */}
          <div className="space-y-8">
            {book && (
              <PublicationTimeline
                bookId={id}
                createdAt={book.createdAt}
                timeline={book.publicationTimeline}
                isbn={book.isbn}
                bookStatus={book.status}
                distributionChannels={book.distributionChannels ?? []}
                distributionStrategy={book.distributionStrategy}
                kdpSelectEnrolled={book.kdpSelectEnrolled}
                kdpSelectExpiry={book.kdpSelectExpiry}
                d2d={{ status: book.d2dStatus, sentAt: book.d2dSentAt }}
                kdp={{ status: book.kdpStatus, sentAt: book.kdpSentAt }}
                google={{ status: book.googleStatus, sentAt: book.googleSentAt }}
                creation={{
                  title: book.title,
                  genre: book.genre,
                  originalDocxUrl: book.originalDocxUrl,
                  manuscriptImportedAt: book.manuscriptImportedAt,
                  manuscriptEditedAt: book.manuscriptEditedAt,
                  priceEbook: book.priceEbook,
                  pricePrint: book.pricePrint,
                  pricePrintHardcover: book.pricePrintHardcover,
                  coverUrl: book.coverUrl,
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

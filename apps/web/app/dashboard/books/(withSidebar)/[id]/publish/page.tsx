"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { StepRow } from "@/components/books/StepRow";
import { DistributionStatus } from "@/components/books/DistributionStatus";
import { PublicationTimeline } from "@/components/books/PublicationTimeline";
import { PublishButton } from "@/components/books/PublishButton";
import { TabletCoverFrame } from "@/components/books/TabletCoverFrame";
import { useBook } from "@/hooks/useBook";

interface PublishBook {
  status: string;
  title: string;
  slug: string;
  coverUrl?: string | null;
  priceEbook?: string | number | null;
  pricePrint?: string | number | null;
  originalDocxUrl?: string | null;
  pdfUrl?: string | null;
  createdAt: string;
  publicationTimeline?: any;
  isbn?: string | null;
  distributionChannels?: string[] | null;
  d2dStatus: string;
  d2dSentAt?: string | null;
  kdpStatus: string;
  kdpSentAt?: string | null;
  googleStatus: string;
  googleSentAt?: string | null;
}

export default function PublishPage() {
  const { id } = useParams<{ id: string }>();
  const { book, setBook, loading } = useBook<PublishBook>(id);

  if (loading) {
    return (
      <div className="p-8">
        <div className="h-96 bg-gray-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  const hasManuscript = !!book?.originalDocxUrl;
  const hasConversion = !!book?.pdfUrl;
  const hasCover = !!book?.coverUrl;
  const isProcessing = book?.status === "PROCESSING";
  const canPublish = hasManuscript && hasConversion && hasCover && !isProcessing;
  const isPublished = book?.status === "PUBLISHED";

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[1.4375rem] font-bold text-black">{book?.title}</h1>
          {isPublished && (
            <div className="flex flex-wrap gap-2.5">
              <Link
                href={`/dashboard/books/${id}/output-data`}
                className="rounded-md border border-black px-4 py-2 text-sm text-black hover:bg-gray-50"
              >
                Редагувати
              </Link>
              <button
                disabled
                title="Скоро — повторна публікація змін"
                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-300 cursor-not-allowed"
              >
                Опублікувати із змінами
              </button>
              <a
                href={`/books/${book.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-black px-4 py-2 text-sm text-black hover:bg-gray-50"
              >
                Сайт книги
              </a>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr]">
          {/* Left: cover + price */}
          <div className="space-y-4">
            <TabletCoverFrame coverUrl={book?.coverUrl} />

            {(book?.priceEbook || book?.pricePrint) && (
              <div className="rounded-md border bg-white p-4 shadow-sm space-y-3">
                <div className="space-y-1 text-sm text-black">
                  {book?.pricePrint && <p>Друкована &nbsp;- {Number(book.pricePrint).toFixed(0)} грн</p>}
                  {book?.priceEbook && <p>Електронна - {Number(book.priceEbook).toFixed(0)} грн</p>}
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
                createdAt={book.createdAt}
                timeline={book.publicationTimeline}
                isbn={book.isbn}
                bookStatus={book.status}
                distributionChannels={book.distributionChannels ?? []}
                d2d={{ status: book.d2dStatus, sentAt: book.d2dSentAt }}
                kdp={{ status: book.kdpStatus, sentAt: book.kdpSentAt }}
                google={{ status: book.googleStatus, sentAt: book.googleSentAt }}
              />
            )}

            <DistributionStatus bookId={id} bookStatus={book?.status ?? "DRAFT"} />

            {!isPublished && (
              <div className="rounded-xl border bg-white p-6 shadow-sm">
                {!canPublish && (
                  <div className="mb-5 space-y-0 divide-y rounded-lg border bg-gray-50 px-4">
                    <StepRow
                      num={1}
                      done={hasManuscript}
                      label="Завантажено рукопис (.docx)"
                      hint="Перетягніть .docx файл у розділ «Рукопис»"
                      action={{ label: "Рукопис", href: `/dashboard/books/${id}/manuscript` }}
                    />
                    <StepRow
                      num={2}
                      done={hasConversion}
                      label="Конвертацію завершено"
                      hint={isProcessing ? "Зачекайте завершення конвертації…" : "Буде автоматично після завантаження"}
                    />
                    <StepRow
                      num={3}
                      done={hasCover}
                      label="Додано обкладинку"
                      hint="Обкладинка потрібна для публікації в магазині"
                      action={{ label: "Редагувати", href: `/dashboard/books/${id}/cover` }}
                    />
                  </div>
                )}

                {isProcessing ? (
                  <div className="flex items-center gap-2 rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                    Конвертація в процесі — кнопка публікації з'явиться автоматично
                  </div>
                ) : (
                  <PublishButton
                    bookId={id}
                    bookStatus={book?.status ?? "DRAFT"}
                    onPublished={() => setBook((b) => (b ? { ...b, status: "PUBLISHED" } : b))}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

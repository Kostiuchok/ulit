"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";
import { PublicationTimeline } from "@/components/books/PublicationTimeline";
import { PublishButton } from "@/components/books/PublishButton";
import { RepublishButton, RepublishPendingNote } from "@/components/books/RepublishButton";
import { UnpublishButton } from "@/components/books/UnpublishButton";
import { RelistButton } from "@/components/books/RelistButton";
import { BookCoverCarousel } from "@/components/books/BookCoverCarousel";
import { BookPromoSidebar } from "@/components/books/BookPromoSidebar";
import { useBook } from "@/hooks/useBook";
import { splitRejectionLines, getUnresolvedRejectionLines } from "@/lib/rejectedBlocks";
import { cn } from "@/lib/utils";

interface DashboardBook {
  status: string;
  title: string;
  slug: string;
  description?: string | null;
  coverUrl?: string | null;
  backCoverUrl?: string | null;
  priceEbook?: string | number | null;
  pricePrint?: string | number | null;
  pricePrintHardcover?: string | number | null;
  pricePrintBw?: string | number | null;
  pricePrintHardcoverBw?: string | number | null;
  bookAuthors?: { lastName: string; firstName: string }[] | null;
  genre?: string | null;
  printWidthMm?: number | null;
  printHeightMm?: number | null;
  printFormatKey?: string | null;
  originalDocxUrl?: string | null;
  docxUpdatedAt?: string | null;
  republishRequestedAt?: string | null;
  pendingTitle?: string | null;
  pendingDescription?: string | null;
  pendingGenre?: string | null;
  unpublishedAt?: string | null;
  manuscriptImportedAt?: string | null;
  manuscriptEditedAt?: string | null;
  pdfUrl?: string | null;
  printPdfUrl?: string | null;
  udcCode?: string | null;
  createdAt: string;
  publishedAt?: string | null;
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
  author?: { contractAcceptedAt?: string | null } | null;
}

export function BookDashboard() {
  const { id } = useParams<{ id: string }>();
  const { book, setBook, loading } = useBook<DashboardBook>(id);
  const [coverNoticeDismissed, setCoverNoticeDismissed] = useState(false);
  const [otherNoticeDismissed, setOtherNoticeDismissed] = useState(false);

  if (loading) {
    return (
      <div className="p-8">
        <div className="h-96 bg-gray-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  const isPublished = book?.status === "PUBLISHED";
  const isUnpublished = book?.status === "UNPUBLISHED";

  // T-2076-ish -- a rejection used to just sit as one raw paragraph of
  // moderationNote until the author saved *anything* on the relevant page
  // (locallyFixed, cover/page.tsx and output-data/page.tsx), which is a
  // blind dismissal -- saving an unrelated tweak clears a still-unresolved
  // "обкладинка застара" note just as readily as actually fixing it. The
  // cover concern specifically can be checked against real data instead of
  // guessing from "did the author click save": book.coverUrl either exists
  // now or it doesn't. Split the note so the cover line(s) get their own
  // monitored block (red while missing, flips green+checked the moment a
  // cover exists -- no save/dismiss action required to notice that), and
  // -- if the rejection was cover-only -- skip the generic block entirely
  // rather than repeat the same line twice.
  //
  // The generic "other" block now reads getUnresolvedRejectionLines -- the
  // exact same per-line live-field check output-data/page.tsx's own banner
  // uses -- instead of raw splitRejectionLines, so the two pages can never
  // show conflicting state: a genre/description/etc. line disappears here
  // the moment that field has a value, same as it does there, without
  // needing the author to click dismiss or to have saved on THIS page.
  const rejectionLines = book?.moderationStatus === "REJECTED" && book.moderationNote
    ? splitRejectionLines(book.moderationNote)
    : [];
  const coverLines = rejectionLines.filter((l) => l.category === "cover");
  const unresolvedOtherLines = book ? getUnresolvedRejectionLines(book).filter((l) => l.category !== "cover") : [];
  const hasCoverNotice = coverLines.length > 0 && !coverNoticeDismissed;
  const coverResolved = !!book?.coverUrl;
  // No categorized lines matched at all (freeform note that didn't hit any
  // keyword) -- fall back to the old undifferentiated block so a rejection
  // never silently shows nothing.
  const showGenericFallback =
    book?.moderationStatus === "REJECTED" && rejectionLines.length === 0 && !otherNoticeDismissed;
  const showOtherBlock = (unresolvedOtherLines.length > 0 || showGenericFallback) && !otherNoticeDismissed;

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="space-y-8">
        {hasCoverNotice && (
          <div
            className={cn(
              "relative rounded-xl border p-5 pr-11 space-y-1.5",
              coverResolved ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
            )}
          >
            <button
              type="button"
              onClick={() => setCoverNoticeDismissed(true)}
              aria-label="Закрити"
              className={cn(
                "absolute right-3 top-3 rounded p-1 transition-colors",
                coverResolved ? "text-green-500 hover:bg-green-100" : "text-red-500 hover:bg-red-100"
              )}
            >
              <X size={16} />
            </button>
            <div className="flex items-center gap-2">
              <span className={coverResolved ? "text-green-600 text-lg" : "text-red-600 text-lg"}>
                {coverResolved ? "✓" : "✕"}
              </span>
              <p className={cn("font-semibold", coverResolved ? "text-green-800" : "text-red-800")}>
                {coverResolved ? "Обкладинка додана" : "Модератор зазначив зауваження щодо обкладинки"}
              </p>
            </div>
            {!coverResolved && (
              <div className="space-y-0.5 pl-6">
                {coverLines.map((l, i) => (
                  <p key={i} className="text-sm text-red-700 whitespace-pre-wrap">{l.text}</p>
                ))}
              </div>
            )}
            <p className={cn("pl-6 text-xs", coverResolved ? "text-green-600" : "text-red-500")}>
              {coverResolved
                ? "Це зауваження вважається вирішеним — модератор перевірить нову обкладинку разом з рештою книги."
                : (
                  <>
                    Виправте на сторінці{" "}
                    <Link href={`/dashboard/books/${id}/cover`} className="underline hover:no-underline">
                      «Обкладинка»
                    </Link>
                    .
                  </>
                )}
            </p>
          </div>
        )}

        {showOtherBlock && (
          <div className="relative rounded-xl border border-red-200 bg-red-50 p-5 pr-11 space-y-2">
            <button
              type="button"
              onClick={() => setOtherNoticeDismissed(true)}
              aria-label="Закрити"
              className="absolute right-3 top-3 rounded p-1 text-red-500 transition-colors hover:bg-red-100"
            >
              <X size={16} />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-red-600 text-lg">✕</span>
              <p className="font-semibold text-red-800">Книгу відхилено модератором</p>
            </div>
            {showGenericFallback ? (
              <p className="text-sm text-red-700 whitespace-pre-wrap">{book!.moderationNote}</p>
            ) : unresolvedOtherLines.length > 0 ? (
              <div className="space-y-0.5">
                {unresolvedOtherLines.map((l, i) => (
                  <p key={i} className="text-sm text-red-700 whitespace-pre-wrap">{l.text}</p>
                ))}
              </div>
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
              <>
                <RepublishButton
                  bookId={id}
                  docxUpdatedAt={book?.docxUpdatedAt}
                  publishedAt={book?.publishedAt}
                  republishRequestedAt={book?.republishRequestedAt}
                  pendingTitle={book?.pendingTitle}
                  pendingDescription={book?.pendingDescription}
                  pendingGenre={book?.pendingGenre}
                  showNote={false}
                  onSubmitted={(republishRequestedAt) =>
                    setBook((b) => (b ? { ...b, republishRequestedAt } : b))
                  }
                />
                <UnpublishButton
                  bookId={id}
                  onUnpublished={() =>
                    setBook((b) => (b ? { ...b, status: "UNPUBLISHED" } : b))
                  }
                />
              </>
            ) : isUnpublished ? (
              <RelistButton
                bookId={id}
                onRelisted={() => setBook((b) => (b ? { ...b, status: "PUBLISHED" } : b))}
              />
            ) : (
              <PublishButton
                bookId={id}
                bookStatus={book?.status ?? "DRAFT"}
                onSubmitted={() => setBook((b) => (b ? { ...b, status: "REVIEW" } : b))}
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
        {/* Rendered on its own line below the whole button row -- inline
            inside RepublishButton it made that one flex item taller than
            its row siblings, which under items-center visually shifted
            "Опублікувати із змінами" up relative to Редагувати/Зняти з
            публікації. */}
        {isPublished && (
          <div className="flex justify-end">
            <RepublishPendingNote
              docxUpdatedAt={book?.docxUpdatedAt}
              publishedAt={book?.publishedAt}
              pendingTitle={book?.pendingTitle}
              pendingDescription={book?.pendingDescription}
              pendingGenre={book?.pendingGenre}
            />
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[320px_1fr_260px]">
          {/* Left: cover + price */}
          <div className="space-y-4">
            <BookCoverCarousel
              coverUrl={book?.coverUrl}
              backCoverUrl={book?.backCoverUrl}
              hasEbook={!!book?.priceEbook || !(book?.pricePrint || book?.pricePrintHardcover)}
              hasPrint={!!(book?.pricePrint || book?.pricePrintHardcover)}
              genre={book?.genre}
              printWidthMm={book?.printWidthMm}
              printHeightMm={book?.printHeightMm}
              printFormatKey={book?.printFormatKey}
            />

            {(book?.priceEbook || book?.pricePrint || book?.pricePrintHardcover) && (
              <div className="rounded-md border bg-white p-4 shadow-sm space-y-3">
                <div className="space-y-1 text-sm text-black">
                  {book?.priceEbook && <p>Електронна - {Number(book.priceEbook).toFixed(0)} грн</p>}
                  {book?.pricePrint && <p>Друк, м&apos;яка - {Number(book.pricePrint).toFixed(0)} грн</p>}
                  {book?.pricePrintHardcover && <p>Друк, тверда - {Number(book.pricePrintHardcover).toFixed(0)} грн</p>}
                </div>
                <Link
                  href={`/dashboard/books/${id}/output-data?step=2`}
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
                contractAcceptedAt={book.author?.contractAcceptedAt}
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
                  printPdfUrl: book.printPdfUrl,
                  udcCode: book.udcCode,
                }}
              />
            )}
          </div>

          {/* Right sidebar: promo — scrolls with the page, not sticky */}
          <div>
            <BookPromoSidebar />
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { History, Link2, MoreHorizontal, Pencil, Trash2, X } from "lucide-react";
import { BookStepsCard } from "@/components/books/BookStepsCard";
import { PublishButton } from "@/components/books/PublishButton";
import { RepublishPrimaryButton, getChangesSummary } from "@/components/books/RepublishButton";
import { UnpublishButton } from "@/components/books/UnpublishButton";
import { RelistButton } from "@/components/books/RelistButton";
import { DeleteBookModal } from "@/components/books/DeleteBookModal";
import { BookCoverCarousel } from "@/components/books/BookCoverCarousel";
import { BookPromoSidebar } from "@/components/books/BookPromoSidebar";
import { useBook } from "@/hooks/useBook";
import { useApi } from "@/hooks/useApi";
import { getAllRejectionLines } from "@/lib/rejectedBlocks";
import { getBookStatusLabel } from "@/lib/bookStatus";
import { cn } from "@/lib/utils";
import { isPublishStepComplete, type PublishStepBook } from "shared-types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  desiredRoyaltyAmount?: string | number | null;
  desiredRoyaltyAmountPrint?: string | number | null;
  genre?: string | null;
  language?: string | null;
  printWidthMm?: number | null;
  printHeightMm?: number | null;
  printFormatKey?: string | null;
  originalDocxUrl?: string | null;
  epubUrl?: string | null;
  docxUpdatedAt?: string | null;
  republishRequestedAt?: string | null;
  pendingTitle?: string | null;
  pendingDescription?: string | null;
  pendingGenre?: string | null;
  pendingCoverUrl?: string | null;
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
  moderationReasons?: string[] | null;
  moderationCustomNote?: string | null;
  moderationFieldSnapshot?: unknown;
  author?: { contractAcceptedAt?: string | null } | null;
}

export function BookDashboard() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  // light:true -- this overview never renders the cover editor canvas, so it
  // has no use for coverDesign/coverImageLibrary (book.ts's BOOK_SELECT_LIGHT).
  const { book, setBook, loading } = useBook<DashboardBook>(id, { light: true });
  const [coverNoticeDismissed, setCoverNoticeDismissed] = useState(false);
  const [otherNoticeDismissed, setOtherNoticeDismissed] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const { apiFetch, token } = useApi();

  // T-2079 -- opening a book (from the sidebar, the book list, or a direct
  // link) is itself the author looking at whatever the moderator said about
  // it. Marks every unread notification FOR THIS BOOK read, then tells the
  // bell (mounted elsewhere, its own separate useNotifications() instance)
  // to refresh.
  //
  // Dispatches "ulit:notifications-changed", NOT "ulit:books-changed" --
  // marking a notification read never changes any Book field, so the
  // `ulit:books-changed` listeners (this same component's own useBook(id),
  // AuthorBooksSidebar, MyBooksList) have nothing to actually refetch.
  // Before this split, opening any book fired THREE redundant requests on
  // top of this one: GET /api/books/:id (refetching what useBook had just
  // loaded a moment earlier), GET /api/books (the sidebar's full list, for
  // data that didn't change), and GET /api/notifications (the only one that
  // actually needed to run). useNotifications listens for both events --
  // this is strictly a narrower signal for the one case that doesn't need
  // the wider one.
  useEffect(() => {
    if (!token || !id) return;
    apiFetch(`/api/notifications/book/${id}/read`, { method: "PATCH" })
      .then(() => window.dispatchEvent(new Event("ulit:notifications-changed")))
      .catch(() => {});
  }, [token, id, apiFetch]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="h-96 bg-gray-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  const isPublished = book?.status === "PUBLISHED";
  const isUnpublished = book?.status === "UNPUBLISHED";
  const statusLabel = book ? getBookStatusLabel(book.status, book.publicationTimeline) : null;
  const { hasChanges, blocks: changedBlocks } = book
    ? getChangesSummary({
        docxUpdatedAt: book.docxUpdatedAt,
        publishedAt: book.publishedAt,
        pendingTitle: book.pendingTitle,
        pendingDescription: book.pendingDescription,
        pendingGenre: book.pendingGenre,
        pendingCoverUrl: book.pendingCoverUrl,
      })
    : { hasChanges: false, blocks: [] as string[] };
  const isRepublishPending = !!book?.republishRequestedAt;

  async function copyBookLink() {
    if (!book) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/books/${book.slug}`);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Clipboard API can be denied (permissions, non-HTTPS context) --
      // silently no-op rather than throw up an error for a nice-to-have.
    }
  }

  // T-2076-ish -- a rejection used to just sit as one raw paragraph of
  // moderationNote until the author saved *anything* on the relevant page
  // (locallyFixed, cover/page.tsx and output-data/page.tsx), which is a
  // blind dismissal -- saving an unrelated tweak clears a still-unresolved
  // "обкладинка застара" note just as readily as actually fixing it.
  //
  // getAllRejectionLines gives every concern (resolved or not) via the same
  // shared logic every other rejection-aware page reads (rejectedBlocks.ts):
  // for a book rejected via the admin's structured reason checkboxes, a
  // concern resolves once its field differs from its value AT the moment of
  // rejection (catches "cover existed but was flagged as bad quality,
  // author reuploaded a different one" -- not just "cover exists", which a
  // rejected-for-quality cover would already satisfy without any real fix);
  // a legacy freeform-only rejection falls back to best-effort presence
  // checks. Split so the cover line(s) get their own monitored block (red
  // while unresolved, flips green+checked the moment it's fixed -- no
  // save/dismiss needed to notice that), and -- if the rejection was
  // cover-only -- the generic block is skipped entirely rather than
  // repeating the same line twice.
  const allRejectionLines = book ? getAllRejectionLines(book) : [];
  const coverLines = allRejectionLines.filter((l) => l.category === "cover");
  const unresolvedOtherLines = allRejectionLines.filter((l) => l.category !== "cover" && !l.resolved);
  const hasCoverNotice = coverLines.length > 0 && !coverNoticeDismissed;
  const coverResolved = coverLines.length > 0 && coverLines.every((l) => l.resolved);
  // REJECTED with literally no note text at all (shouldn't happen via the
  // current admin UI, which requires picking a reason or writing a note,
  // but a stray API call could still leave a book in this state) -- fall
  // back to a generic notice so a rejection never silently shows nothing.
  const showGenericFallback = book?.moderationStatus === "REJECTED" && !book?.moderationNote && !otherNoticeDismissed;
  const showOtherBlock = (unresolvedOtherLines.length > 0 || showGenericFallback) && !otherNoticeDismissed;

  return (
    // min-h-full, not min-h-screen: this sits inside a scroll pane that is
    // shorter than the viewport (site header + top bar), so min-h-screen made
    // even a short page overflow it and show a scrollbar.
    <div className="min-h-full bg-white p-8">
      <div className="space-y-8">
        {hasCoverNotice && (
          <div
            className={cn(
              "relative rounded-xl border p-5 pr-11 space-y-1.5",
              coverResolved ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
            )}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setCoverNoticeDismissed(true)}
              aria-label="Закрити"
              className={cn(
                "absolute right-3 top-3 h-auto w-auto rounded p-1",
                coverResolved ? "text-green-500 hover:bg-green-100 hover:text-green-500" : "text-red-500 hover:bg-red-100 hover:text-red-500"
              )}
            >
              <X size={16} />
            </Button>
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
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setOtherNoticeDismissed(true)}
              aria-label="Закрити"
              className="absolute right-3 top-3 h-auto w-auto rounded p-1 text-red-500 hover:bg-red-100 hover:text-red-500"
            >
              <X size={16} />
            </Button>
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

        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[1.4375rem] font-bold text-black">{book?.title}</h1>
            {statusLabel && (
              <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", statusLabel.className)}>
                {statusLabel.label}
              </span>
            )}
          </div>
          {isPublished && book?.publishedAt && (
            <p className="mt-1 text-xs text-gray-500">
              Остання публікація: {new Date(book.publishedAt).toLocaleDateString("uk-UA")}
              {isRepublishPending ? (
                <span className="font-medium text-amber-700"> · зміни на модерації</span>
              ) : hasChanges ? (
                <span className="font-medium text-amber-700"> · є зміни на модерацію</span>
              ) : (
                <span> · усі зміни опубліковано</span>
              )}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <Button asChild variant="outline" className="gap-1.5 border-black text-black hover:bg-gray-50 hover:text-black">
              <Link href={`/dashboard/books/${id}/output-data`}>
                <Pencil size={14} />
                Редагувати
              </Link>
            </Button>
            {isPublished ? (
              <>
                {isRepublishPending ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3.5 py-2 text-sm font-medium text-amber-700">
                    ⏳ На модерації
                  </div>
                ) : hasChanges ? (
                  <RepublishPrimaryButton
                    bookId={id}
                    docxUpdatedAt={book?.docxUpdatedAt}
                    publishedAt={book?.publishedAt}
                    republishRequestedAt={book?.republishRequestedAt}
                    pendingTitle={book?.pendingTitle}
                    pendingDescription={book?.pendingDescription}
                    pendingGenre={book?.pendingGenre}
                    pendingCoverUrl={book?.pendingCoverUrl}
                    onSubmitted={(republishRequestedAt) =>
                      setBook((b) => (b ? { ...b, republishRequestedAt } : b))
                    }
                  />
                ) : null}
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
              <Button
                asChild
                variant={hasChanges || isRepublishPending ? "outline" : "default"}
                className={cn(
                  "gap-1.5",
                  (hasChanges || isRepublishPending) && "border-black text-black hover:bg-gray-50 hover:text-black"
                )}
              >
                <a href={`/books/${book.slug}`} target="_blank" rel="noopener noreferrer">
                  Сайт книги
                </a>
              </Button>
            ) : (
              <Button variant="outline" disabled title="Доступно після публікації" className="cursor-not-allowed border-gray-300 text-gray-300">
                Сайт книги
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Більше дій" className="border-gray-300">
                  <MoreHorizontal size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuItem disabled={!isPublished} onClick={copyBookLink} className="gap-2.5">
                  <Link2 size={15} className="text-gray-500" />
                  {linkCopied ? "Посилання скопійовано ✓" : "Копіювати посилання на книгу"}
                </DropdownMenuItem>
                <DropdownMenuItem disabled title="Функція в розробці" className="gap-2.5">
                  <History size={15} className="text-gray-500" />
                  Історія публікацій
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {isPublished && (
                  <UnpublishButton
                    bookId={id}
                    onUnpublished={() => setBook((b) => (b ? { ...b, status: "UNPUBLISHED" } : b))}
                    trigger={(open) => (
                      <DropdownMenuItem onClick={open} className="gap-2.5 text-red-600 focus:text-red-600">
                        <X size={15} />
                        Зняти з публікації
                      </DropdownMenuItem>
                    )}
                  />
                )}
                <DropdownMenuItem onClick={() => setDeleteModalOpen(true)} className="gap-2.5 text-red-600 focus:text-red-600">
                  <Trash2 size={15} />
                  Видалити книгу
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Банер змін на модерацію -- WF-SPEC "01 Дашборд" п.7. Лише зміни
            змісту (вихідні дані, рукопис) -- ціни в ULIT діють одразу й сюди
            не входять (Рішення 03.10). */}
        {isPublished && !isRepublishPending && hasChanges && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <span className="mt-0.5 shrink-0 text-amber-600">⚠</span>
            <div className="text-sm">
              <div className="font-semibold text-amber-900">Зміни на модерацію: {changedBlocks.join(", ")}</div>
              <div className="mt-0.5 text-amber-800">
                Після «Надіслати на модерацію» їх перевірить адміністратор. До схвалення в магазинах лишається
                поточна версія.
              </div>
            </div>
            <Link
              href={`/dashboard/books/${id}/output-data/review`}
              className="ml-auto shrink-0 text-xs font-medium text-amber-900 underline"
            >
              Що змінилось?
            </Link>
          </div>
        )}

        {book && (
          <BookStepsCard
            bookId={id}
            createdAt={book.createdAt}
            timeline={book.publicationTimeline}
            contractAcceptedAt={book.author?.contractAcceptedAt}
            isbn={book.isbn}
            bookStatus={book.status}
            distributionChannels={book.distributionChannels ?? []}
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
            readiness={{
              info: isPublishStepComplete("info", book as PublishStepBook),
              file: isPublishStepComplete("file", book as PublishStepBook),
              cover: isPublishStepComplete("cover", book as PublishStepBook),
              price: isPublishStepComplete("price", book as PublishStepBook),
            }}
          />
        )}

        {/* Three fixed-ish columns (320 + 1fr + 260 + gaps) need ~1200px of
            CONTENT width. A landscape tablet (1024-1194px) loses 256px of that
            to the app sidebar, which squeezed the middle column (author
            report, tablet QA). Below xl: cover+price left, promo full width
            underneath. */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_280px]">
          {/* Left: cover + preview link */}
          <div className="space-y-2">
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
            <Link
              href={`/dashboard/books/${id}/manuscript/preview`}
              className="block text-center text-xs text-gray-500 underline hover:no-underline"
            >
              Попередній перегляд
            </Link>
          </div>

          {/* Middle: compact price card -- WF-SPEC п.8, above the fold */}
          <div className="min-w-0">
            {(book?.priceEbook || book?.pricePrint || book?.pricePrintHardcover) && (
              <Card className="p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ціни</h2>
                  <Link
                    href={`/dashboard/books/${id}/output-data/price`}
                    className="inline-flex items-center gap-1 text-xs font-medium underline hover:no-underline"
                  >
                    <Pencil size={12} />
                    Змінити ціну
                  </Link>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-gray-50 px-2 py-2">
                    <div className="text-xs text-gray-500">Електронна</div>
                    <div className="text-base font-semibold text-black">
                      {book?.priceEbook ? `${Number(book.priceEbook).toFixed(0)} грн` : "—"}
                    </div>
                  </div>
                  <div className="rounded-lg bg-gray-50 px-2 py-2">
                    <div className="text-xs text-gray-500">Друк, м&apos;яка</div>
                    <div className="text-base font-semibold text-black">
                      {book?.pricePrint ? `${Number(book.pricePrint).toFixed(0)} грн` : "—"}
                    </div>
                  </div>
                  <div className="rounded-lg bg-gray-50 px-2 py-2">
                    <div className="text-xs text-gray-500">Друк, тверда</div>
                    <div className="text-base font-semibold text-black">
                      {book?.pricePrintHardcover ? `${Number(book.pricePrintHardcover).toFixed(0)} грн` : "—"}
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Right sidebar: promo — scrolls with the page, not sticky. Below xl
              it drops under the two columns above instead of a third column. */}
          <div className="lg:col-span-2 xl:col-span-1">
            <BookPromoSidebar bookId={id} />
          </div>
        </div>
      </div>

      {deleteModalOpen && book && (
        <DeleteBookModal
          bookId={id}
          bookStatus={book.status}
          onClose={() => setDeleteModalOpen(false)}
          onDeleted={() => {
            setDeleteModalOpen(false);
            window.dispatchEvent(new Event("ulit:books-changed"));
            router.push("/dashboard/books");
          }}
        />
      )}
    </div>
  );
}

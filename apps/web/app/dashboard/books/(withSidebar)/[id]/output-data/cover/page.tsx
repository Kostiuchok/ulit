"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { OutputDataSectionHeading } from "@/components/dashboard/OutputDataSectionHeading";
import { BookCoverCarousel } from "@/components/books/BookCoverCarousel";
import { Card } from "@/components/ui/card";
import { useBook } from "@/hooks/useBook";
import { getUnresolvedRejectionLines } from "@/lib/rejectedBlocks";
import { SECTION_LABELS } from "@/lib/outputDataSections";
import { cn } from "@/lib/utils";
import { isPublishStepComplete } from "shared-types";

interface CoverBook {
  coverUrl?: string | null;
  backCoverUrl?: string | null;
  genre?: string | null;
  printWidthMm?: number | null;
  printHeightMm?: number | null;
  printFormatKey?: string | null;
  priceEbook?: number | string | null;
  pricePrint?: number | string | null;
  pricePrintHardcover?: number | string | null;
  moderationStatus?: string | null;
  moderationNote?: string | null;
  moderationReasons?: string[] | null;
  moderationCustomNote?: string | null;
  moderationFieldSnapshot?: unknown;
}

export default function OutputDataCoverPage() {
  const { id } = useParams<{ id: string }>();
  const { book, loading } = useBook<CoverBook>(id);

  if (loading) {
    return <div className="h-96 bg-gray-200 rounded-xl animate-pulse" />;
  }

  const coverSectionDone = isPublishStepComplete("cover", book ?? {});
  const unresolvedRejectionLines = book ? getUnresolvedRejectionLines(book) : [];
  const coverRejected = unresolvedRejectionLines.some((l) => l.category === "cover");

  return (
    <div className="space-y-3">
      <OutputDataSectionHeading label={SECTION_LABELS.cover} done={coverSectionDone && !coverRejected} />
      {/* Without its own section here, authors routinely skipped straight to
          "Надіслати на модерацію" with no cover at all -- admin kept
          bouncing the same books back for доопрацювання. A dedicated,
          checklist-styled block (✓/○, same language as
          IsbnReadinessChecklist on the "Огляд" tab) makes the missing step
          visible instead of only surfacing as a rejection after the fact. */}
      <Card className={cn("p-6 shadow-sm space-y-4", coverRejected && "border-2 border-red-400")}>
        {/* Author-requested: check the cover is actually there without
            leaving this page for the full editor. Same BookCoverCarousel
            the book's own dashboard/store page use -- real electronic
            (TabletCoverFrame) and print-wrap (PrintedCoverFrame, correct
            per-book trim) slides, not a placeholder. */}
        {book?.coverUrl && (
          <div className="mx-auto w-full max-w-[220px]">
            <BookCoverCarousel
              coverUrl={book.coverUrl}
              backCoverUrl={book.backCoverUrl}
              genre={book.genre}
              printWidthMm={book.printWidthMm}
              printHeightMm={book.printHeightMm}
              printFormatKey={book.printFormatKey}
              hasEbook={!!book.priceEbook || !(book.pricePrint || book.pricePrintHardcover)}
              hasPrint={!!(book.pricePrint || book.pricePrintHardcover)}
            />
          </div>
        )}

        <div className="flex items-start gap-2 text-sm">
          <span className={cn("mt-0.5", book?.coverUrl ? "text-green-600" : "text-amber-500")}>
            {book?.coverUrl ? "✓" : "○"}
          </span>
          <span className={book?.coverUrl ? "text-gray-700" : "text-gray-500"}>
            {book?.coverUrl ? "Обкладинка завантажена" : "Обкладинка ще не створена"}
            {!book?.coverUrl && (
              <span className="block text-xs text-amber-600">
                Обов&apos;язково для модерації — без обкладинки адмін поверне книгу на доопрацювання.
              </span>
            )}
          </span>
        </div>
        <Link
          href={`/dashboard/books/${id}/cover`}
          className="inline-block text-sm text-black underline hover:no-underline"
        >
          {book?.coverUrl ? "Редагувати обкладинку →" : "Створити обкладинку →"}
        </Link>
      </Card>
    </div>
  );
}

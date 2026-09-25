"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { OutputDataSectionHeading } from "@/components/dashboard/OutputDataSectionHeading";
import { CollapsibleSection } from "@/components/dashboard/CollapsibleSection";
import { BookCoverCarousel } from "@/components/books/BookCoverCarousel";
import { CoverPrintSpread } from "@/components/books/CoverPrintSpread";
import { TabletCoverFrame } from "@/components/books/TabletCoverFrame";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useBook } from "@/hooks/useBook";
import { getUnresolvedRejectionLines } from "@/lib/rejectedBlocks";
import { SECTION_LABELS } from "@/lib/outputDataSections";
import { cn } from "@/lib/utils";
import { isPublishStepComplete, resolveBookPrintFormat } from "shared-types";

interface CoverBook {
  coverUrl?: string | null;
  backCoverUrl?: string | null;
  spineUrl?: string | null;
  genre?: string | null;
  printWidthMm?: number | null;
  printHeightMm?: number | null;
  printFormatKey?: string | null;
  printPageCount?: number | null;
  pageCount?: number | null;
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
  const trimMm = book ? resolveBookPrintFormat(book) : null;
  const printPageCount = book?.printPageCount ?? book?.pageCount;

  return (
    <div className="space-y-3">
      <OutputDataSectionHeading label={SECTION_LABELS.cover} done={coverSectionDone && !coverRejected} />

      {/* Author-requested: check the cover is actually there without
          leaving this page for the full editor. "Передперегляд" -- слайдер
          (друковані перед/зад) зліва, електронна книжка (планшет-мокап)
          справа, обидва видно одночасно, не перемикаючи вкладки. */}
      {book?.coverUrl && (
        <Card className="border border-gray-300 p-6 shadow-sm">
          <CollapsibleSection title="Передперегляд">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="w-full">
              <BookCoverCarousel
                coverUrl={book.coverUrl}
                backCoverUrl={book.backCoverUrl}
                genre={book.genre}
                printWidthMm={book.printWidthMm}
                printHeightMm={book.printHeightMm}
                printFormatKey={book.printFormatKey}
                hasEbook={false}
                hasPrint
              />
            </div>
            <div className="w-full">
              <TabletCoverFrame coverUrl={book.coverUrl} />
            </div>
          </div>
          </CollapsibleSection>
        </Card>
      )}

      {/* "Обкладинка для друку" -- на всю ширину контенту, м'яка обкладинка
          зверху й тверда під нею (не поруч), бо це два окремі, повноцінно
          читабельні розвороти, а не пара мініатюр. Той самий плаский
          розгорнутий вигляд (перед+корінець+зад) з лініями згину, що й
          раніше -- геометрія ідентична CoverDesignerCanvas's власним
          напрямним корінця, це навмисно все, що реально побачить модератор,
          не наближення. */}
      {book?.coverUrl && trimMm && (
        <Card className="border border-gray-300 p-6 shadow-sm">
          <CollapsibleSection title="Обкладинка для друку">
          <div className="space-y-6">
            <CoverPrintSpread
              coverUrl={book.coverUrl}
              backCoverUrl={book.backCoverUrl}
              spineUrl={book.spineUrl}
              format="softcover"
              pageCount={printPageCount}
              trimMm={trimMm}
              label="М'яка обкладинка — розворот з лініями згину"
            />
            <CoverPrintSpread
              coverUrl={book.coverUrl}
              backCoverUrl={book.backCoverUrl}
              spineUrl={book.spineUrl}
              format="hardcover"
              pageCount={printPageCount}
              trimMm={trimMm}
              label="Тверда обкладинка — розворот з лініями згину"
            />
          </div>
          </CollapsibleSection>
        </Card>
      )}

      {/* Without its own section here, authors routinely skipped straight to
          "Надіслати на модерацію" with no cover at all -- admin kept
          bouncing the same books back for доопрацювання. A dedicated,
          checklist-styled block (✓/○, same language as
          IsbnReadinessChecklist on the "Огляд" tab) makes the missing step
          visible instead of only surfacing as a rejection after the fact. */}
      <Card className={cn("p-6 shadow-sm space-y-3", coverRejected && "border-2 border-red-400")}>
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
        <Button asChild>
          <Link href={`/dashboard/books/${id}/cover`}>
            {book?.coverUrl ? "Редагувати обкладинку" : "Створити обкладинку"}
          </Link>
        </Button>
      </Card>
    </div>
  );
}

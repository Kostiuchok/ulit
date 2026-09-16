"use client";

import { useEffect, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { OutputDataSectionHeading } from "@/components/dashboard/OutputDataSectionHeading";
import { PublishButton, type PublishButtonHandle } from "@/components/books/PublishButton";
import { RepublishButton } from "@/components/books/RepublishButton";
import { Card } from "@/components/ui/card";
import { useBook } from "@/hooks/useBook";
import { getUnresolvedRejectionLines } from "@/lib/rejectedBlocks";
import { SECTION_LABELS } from "@/lib/outputDataSections";
import { isPublishStepComplete } from "shared-types";

interface PublishBook {
  status?: string | null;
  docxUpdatedAt?: string | null;
  publishedAt?: string | null;
  republishRequestedAt?: string | null;
  pendingTitle?: string | null;
  pendingDescription?: string | null;
  pendingGenre?: string | null;
  moderationStatus?: string | null;
  moderationNote?: string | null;
  moderationReasons?: string[] | null;
  moderationCustomNote?: string | null;
  moderationFieldSnapshot?: unknown;
  // isPublishStepComplete's fields (readyToPublish gate below)
  title?: string | null;
  description?: string | null;
  ageRating?: string | null;
  coverUrl?: string | null;
  originalDocxUrl?: string | null;
  pdfUrl?: string | null;
  epubUrl?: string | null;
  priceEbook?: number | string | null;
  pricePrint?: number | string | null;
  pricePrintHardcover?: number | string | null;
  pricePrintBw?: number | string | null;
  pricePrintHardcoverBw?: number | string | null;
  desiredRoyaltyAmount?: number | string | null;
  desiredRoyaltyAmountPrint?: number | string | null;
  bookAuthors?: { lastName: string; firstName: string }[] | null;
}

export default function OutputDataPublishPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { book, setBook, loading } = useBook<PublishBook>(id);
  const publishButtonRef = useRef<PublishButtonHandle>(null);

  // The "Публікація" nav pill, while the book is still a draft, is a direct
  // shortcut -- clicking it navigates here with ?autovalidate=1 and this
  // page immediately runs the same validate step PublishButton's own
  // trigger button would, opening the confirm panel without an extra click.
  // (Same effective one-click UX as before the route split, without a
  // cross-route ref into a page that hadn't mounted yet.)
  const autovalidateRequested = useRef(searchParams.get("autovalidate") === "1");
  useEffect(() => {
    if (autovalidateRequested.current && book) {
      autovalidateRequested.current = false;
      publishButtonRef.current?.submit();
    }
  }, [book]);

  if (loading) {
    return <div className="h-96 bg-gray-200 rounded-xl animate-pulse" />;
  }

  const infoSectionDone = isPublishStepComplete("info", book ?? {});
  const fileSectionDone = isPublishStepComplete("file", book ?? {});
  const coverSectionDone = isPublishStepComplete("cover", book ?? {});
  const priceSectionDone = isPublishStepComplete("price", book ?? {});
  const unresolvedRejectionLines = book ? getUnresolvedRejectionLines(book) : [];
  const anyRejected = unresolvedRejectionLines.length > 0;
  const readyToPublish = infoSectionDone && fileSectionDone && coverSectionDone && priceSectionDone && !anyRejected;

  return (
    <div className="space-y-3">
      <OutputDataSectionHeading label={SECTION_LABELS.publish} done={readyToPublish} />
      <Card className="p-6 shadow-sm space-y-3">
        <PublishButton
          ref={publishButtonRef}
          bookId={id}
          bookStatus={book?.status ?? ""}
          hideTrigger
          readyToPublish={readyToPublish}
          onSubmitted={() => setBook((b) => (b ? { ...b, status: "REVIEW" } : b))}
        />
        {/* PublishButton's PUBLISHED branch is just a static badge -- for a
            live book, editing Назва/Анотація/Жанр on "Інформація" stages the
            change instead of publishing instantly, so the actual "send it
            live" action for THOSE fields is this button, not PublishButton. */}
        {book?.status === "PUBLISHED" && (
          <RepublishButton
            bookId={id}
            docxUpdatedAt={book?.docxUpdatedAt}
            publishedAt={book?.publishedAt}
            republishRequestedAt={book?.republishRequestedAt}
            pendingTitle={book?.pendingTitle}
            pendingDescription={book?.pendingDescription}
            pendingGenre={book?.pendingGenre}
            onSubmitted={(republishRequestedAt) =>
              setBook((b) => (b ? { ...b, republishRequestedAt } : b))
            }
          />
        )}
      </Card>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { OutputDataSectionHeading } from "@/components/dashboard/OutputDataSectionHeading";
import { CollapsibleSection } from "@/components/dashboard/CollapsibleSection";
import { PreviewRangeEditor } from "@/components/books/PreviewRangeEditor";
import { DocxUploader } from "@/components/dashboard/DocxUploader";
import { Card } from "@/components/ui/card";
import { useBook } from "@/hooks/useBook";
import { useApi } from "@/hooks/useApi";
import { getUnresolvedRejectionLines } from "@/lib/rejectedBlocks";
import { SECTION_LABELS } from "@/lib/outputDataSections";
import { cn } from "@/lib/utils";
import { isPublishStepComplete } from "shared-types";

interface FileBook {
  originalDocxUrl?: string | null;
  docxUpdatedAt?: string | null;
  pdfUrl?: string | null;
  epubUrl?: string | null;
  printPdfUrl?: string | null;
  printPageCount?: number | null;
  pageCount?: number | null;
  previewStart?: number | null;
  previewEnd?: number | null;
  moderationStatus?: string | null;
  moderationNote?: string | null;
  moderationReasons?: string[] | null;
  moderationCustomNote?: string | null;
  moderationFieldSnapshot?: unknown;
}

type ManuscriptStats =
  | { status: "NO_CONTENT" }
  | { status: "DONE"; characters: number; words: number; images: number };

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-gray-50 px-3 py-2 text-center">
      <p className="text-lg font-bold text-gray-900">{value}</p>
      <p className="text-[11px] text-gray-500">{label}</p>
    </div>
  );
}

export default function OutputDataFilePage() {
  const { id } = useParams<{ id: string }>();
  const { apiFetch, token } = useApi();
  const { book, setBook, loading } = useBook<FileBook>(id);
  const [stats, setStats] = useState<ManuscriptStats | null>(null);

  // Author-requested: a short at-a-glance overview right here, without
  // opening the full editor -- pageCount is already on the book (from the
  // print PDF render); characters/words/images need their own lightweight
  // endpoint (walks manuscriptContent server-side) since that JSON isn't
  // otherwise fetched on this page at all.
  useEffect(() => {
    if (!id || !token) return;
    apiFetch<ManuscriptStats>(`/api/books/${id}/manuscript-stats`).then(setStats).catch(() => {});
  }, [id, token, apiFetch]);

  if (loading) {
    return <div className="h-96 bg-gray-200 rounded-xl animate-pulse" />;
  }

  const fileSectionDone = isPublishStepComplete("file", book ?? {});
  const unresolvedRejectionLines = book ? getUnresolvedRejectionLines(book) : [];
  const manuscriptRejected = unresolvedRejectionLines.some((l) => l.category === "manuscript");

  return (
    <div className="space-y-3">
      <OutputDataSectionHeading label={SECTION_LABELS.file} done={fileSectionDone && !manuscriptRejected} />

      {/* Its own card, gray-bordered -- separate from the upload block
          below on purpose (author-requested): these are read-only
          statistics about the manuscript's content, not part of the
          upload/replace decision the card below is about. Same heading
          style as "Рукопис (.docx)" so the two cards read as siblings, not
          a subsection of one another. */}
      {book?.originalDocxUrl && (
        <Card className="border border-gray-300 p-6 shadow-sm">
          <CollapsibleSection title="Короткий огляд рукопису">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile
              label="сторінок (друк)"
              value={book?.printPageCount != null ? String(book.printPageCount) : "—"}
            />
            <StatTile
              label="символів"
              value={stats?.status === "DONE" ? stats.characters.toLocaleString("uk-UA") : "—"}
            />
            <StatTile
              label="слів"
              value={stats?.status === "DONE" ? stats.words.toLocaleString("uk-UA") : "—"}
            />
            <StatTile
              label="зображень"
              value={stats?.status === "DONE" ? String(stats.images) : "—"}
            />
          </div>
          </CollapsibleSection>
        </Card>
      )}

      <Card className={cn("p-6 shadow-sm", manuscriptRejected && "border-2 border-red-400")}>
        <CollapsibleSection title="Рукопис (.docx)" description="Завантажте файл або замініть уже завантажений.">
        <div className="space-y-4">
        <DocxUploader
          bookId={id}
          currentDocxUrl={book?.originalDocxUrl}
          onUploadSuccess={(docxPath) => {
            setBook((b) =>
              b
                ? { ...b, originalDocxUrl: docxPath ?? b.originalDocxUrl, docxUpdatedAt: new Date().toISOString() }
                : b
            );
            // layout.tsx's top nav pills (✓/○ badges) read their own
            // separate useBook(id) instance -- without this, the "Рукопис"
            // pill stayed stuck on its pre-upload state.
            window.dispatchEvent(new Event("ulit:books-changed"));
          }}
        />
        <Link
          href={`/dashboard/books/${id}/manuscript`}
          className="inline-block text-sm text-black underline hover:no-underline"
        >
          Редагувати текст рукопису →
        </Link>

        {/* printPdfUrl is only ever produced by opening /manuscript/preview
            (print-preview.ts renders it lazily on GET) -- a missing print
            PDF is fundamentally a "рукопис не доопрацьований" state, not
            only an ISBN blocker. Sends the author to the actual page instead
            of triggering generation blind, so they see the real flipbook
            result, not just a background job. */}
        <div className="flex items-start gap-2 border-t pt-4 text-sm">
          <span className={cn("mt-0.5", book?.printPdfUrl ? "text-green-600" : "text-amber-500")}>
            {book?.printPdfUrl ? "✓" : "○"}
          </span>
          <span className={book?.printPdfUrl ? "text-gray-700" : "text-gray-500"}>
            {book?.printPdfUrl ? "PDF для друку згенеровано" : "PDF для друку ще не згенеровано"}
            {!book?.printPdfUrl && (
              <Link
                href={`/dashboard/books/${id}/manuscript/preview`}
                className="block text-xs text-black underline hover:no-underline"
              >
                Відкрити «Передперегляд книги» (згенерує його) →
              </Link>
            )}
          </span>
        </div>
        </div>
        </CollapsibleSection>
      </Card>

      {/* Setting the free-preview page range is manuscript-content work,
          same as uploading/editing the .docx above. */}
      {book?.epubUrl && (
        <Card className="p-6 shadow-sm">
          <CollapsibleSection
            title="Уривок для читачів"
            description="Встановіть діапазон сторінок, які покупці зможуть прочитати безкоштовно."
          >
          <PreviewRangeEditor
            bookId={id}
            pageCount={book?.pageCount}
            initialStart={book?.previewStart}
            initialEnd={book?.previewEnd}
            onSaved={(start, end) =>
              setBook((b) => (b ? { ...b, previewStart: start, previewEnd: end } : b))
            }
          />
          </CollapsibleSection>
        </Card>
      )}
    </div>
  );
}

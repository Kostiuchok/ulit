"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { OutputDataSectionHeading } from "@/components/dashboard/OutputDataSectionHeading";
import { PreviewRangeEditor } from "@/components/books/PreviewRangeEditor";
import { DocxUploader } from "@/components/dashboard/DocxUploader";
import { useBook } from "@/hooks/useBook";
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
  pageCount?: number | null;
  previewStart?: number | null;
  previewEnd?: number | null;
  moderationStatus?: string | null;
  moderationNote?: string | null;
  moderationReasons?: string[] | null;
  moderationCustomNote?: string | null;
  moderationFieldSnapshot?: unknown;
}

export default function OutputDataFilePage() {
  const { id } = useParams<{ id: string }>();
  const { book, setBook, loading } = useBook<FileBook>(id);

  if (loading) {
    return <div className="h-96 bg-gray-200 rounded-xl animate-pulse" />;
  }

  const fileSectionDone = isPublishStepComplete("file", book ?? {});
  const unresolvedRejectionLines = book ? getUnresolvedRejectionLines(book) : [];
  const manuscriptRejected = unresolvedRejectionLines.some((l) => l.category === "manuscript");

  return (
    <div className="space-y-3">
      <OutputDataSectionHeading label={SECTION_LABELS.file} done={fileSectionDone && !manuscriptRejected} />
      <div className={cn("rounded-xl bg-white p-6 shadow-sm space-y-4", manuscriptRejected ? "border-2 border-red-400" : "border")}>
        <div>
          <h3 className="text-base font-semibold mb-1">Рукопис (.docx)</h3>
          <p className="text-xs text-gray-500">Завантажте файл або замініть уже завантажений.</p>
        </div>
        <DocxUploader
          bookId={id}
          currentDocxUrl={book?.originalDocxUrl}
          onUploadSuccess={(docxPath) =>
            setBook((b) =>
              b
                ? { ...b, originalDocxUrl: docxPath ?? b.originalDocxUrl, docxUpdatedAt: new Date().toISOString() }
                : b
            )
          }
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

      {/* Setting the free-preview page range is manuscript-content work,
          same as uploading/editing the .docx above. */}
      {book?.epubUrl && (
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold mb-1">Уривок для читачів</h2>
          <p className="text-xs text-gray-500 mb-4">
            Встановіть діапазон сторінок, які покупці зможуть прочитати безкоштовно.
          </p>
          <PreviewRangeEditor
            bookId={id}
            pageCount={book?.pageCount}
            initialStart={book?.previewStart}
            initialEnd={book?.previewEnd}
            onSaved={(start, end) =>
              setBook((b) => (b ? { ...b, previewStart: start, previewEnd: end } : b))
            }
          />
        </div>
      )}
    </div>
  );
}

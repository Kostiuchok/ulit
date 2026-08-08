"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { DocxUploader } from "@/components/dashboard/DocxUploader";
import { ConversionStatus } from "@/components/dashboard/ConversionStatus";
import { useBook } from "@/hooks/useBook";
import { parseRejectedConcerns } from "@/lib/rejectedBlocks";
import { cn } from "@/lib/utils";

interface ManuscriptBook {
  status: string;
  originalDocxUrl?: string | null;
  moderationStatus?: string | null;
  moderationNote?: string | null;
}

export default function ManuscriptPage() {
  const { id } = useParams<{ id: string }>();
  const { book, setBook, loading } = useBook<ManuscriptBook>(id);
  const [conversionActive, setConversionActive] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [locallyFixed, setLocallyFixed] = useState(false);

  useEffect(() => {
    if (book && !initialized) {
      setConversionActive(book.status === "PROCESSING");
      setInitialized(true);
    }
  }, [book, initialized]);

  if (loading) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="h-96 bg-gray-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  const rejected = book ? parseRejectedConcerns(book) : { cover: false, manuscript: false, metadata: false };
  const showRejection = rejected.manuscript && !locallyFixed;

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-lg font-semibold text-gray-900">Рукопис (.docx)</h1>

        {showRejection && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 whitespace-pre-wrap">
            Модератор зазначив зауваження щодо рукопису: {book?.moderationNote}
          </div>
        )}

        <div className={cn("rounded-xl bg-white p-6 shadow-sm", showRejection ? "border-2 border-red-400" : "border")}>
          <DocxUploader
            bookId={id}
            currentDocxUrl={book?.originalDocxUrl}
            onUploadSuccess={() => {
              setConversionActive(true);
              setLocallyFixed(true);
              setBook((b) => (b ? { ...b, status: "PROCESSING", originalDocxUrl: "uploaded" } : b));
            }}
          />
        </div>

        <ConversionStatus
          bookId={id}
          active={conversionActive}
          onDone={(newStatus) => {
            setBook((b) => (b ? { ...b, status: newStatus } : b));
          }}
        />
      </div>
    </div>
  );
}

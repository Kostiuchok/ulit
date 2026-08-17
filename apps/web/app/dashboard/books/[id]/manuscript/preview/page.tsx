"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Download } from "lucide-react";
import { useApi } from "@/hooks/useApi";

// T-2057 -- "Передперегляд = сама генерація друкованого PDF" (docs/T-2057-checklist.md
// section 0). This page no longer runs its own client-side pagination; it
// triggers the same GET /api/books/:id/print-preview the "Завантажити PDF"
// QA link resolves to, and shows exactly that file. What the author sees
// here IS the print file, not an approximation of it.
type PrintPreviewStatus =
  | { status: "NO_MANUSCRIPT" }
  | { status: "PROCESSING"; progress: number }
  | { status: "DONE"; printPdfUrl: string; printPageCount: number | null };

export default function ManuscriptPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const { apiFetch, token } = useApi();
  const [state, setState] = useState<PrintPreviewStatus | null>(null);
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await apiFetch<PrintPreviewStatus>(`/api/books/${id}/print-preview`);
      setState(res);
      setError("");
      if (res.status !== "PROCESSING" && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    } catch (e: any) {
      setError(e.message || "Не вдалося сформувати передперегляд");
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
  }, [id, apiFetch]);

  useEffect(() => {
    if (!token) return;
    poll();
    pollRef.current = setInterval(poll, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id]);

  const backLink = (
    <Link
      href={`/dashboard/books/${id}/manuscript`}
      className="flex items-center gap-2 px-4 py-3 text-[0.875rem] font-medium text-black hover:bg-gray-50"
    >
      <ChevronLeft size={14} className="shrink-0 text-gray-500" />
      До редактора рукопису
    </Link>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200">
        {backLink}
        {/* T-2057 п.4 -- temporary QA link, byte-for-byte the same file the
            viewer below shows. Remove once the pipeline has a confirmed live
            test (docs/T-2057-checklist.md checklist). */}
        {state?.status === "DONE" && (
          <a
            href={state.printPdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-3 text-[0.8125rem] text-gray-500 hover:text-black"
          >
            <Download size={13} className="shrink-0" />
            Завантажити PDF (QA)
          </a>
        )}
      </div>

      <div className="min-h-0 flex-1">
        {error && (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-red-500">
            {error}
          </div>
        )}

        {!error && (!state || state.status === "NO_MANUSCRIPT") && (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            Спочатку завантажте й імпортуйте рукопис у редакторі.
          </div>
        )}

        {!error && state?.status === "PROCESSING" && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-gray-500">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
            Формуємо друкований PDF… {state.progress > 0 ? `${state.progress}%` : ""}
          </div>
        )}

        {!error && state?.status === "DONE" && (
          <iframe
            src={state.printPdfUrl}
            title="Передперегляд друкованого PDF"
            className="h-full w-full border-0"
          />
        )}
      </div>
    </div>
  );
}

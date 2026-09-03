"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Download, Palette } from "lucide-react";
import { resolveBookPrintFormat } from "shared-types";
import { useApi } from "@/hooks/useApi";
import { useBook } from "@/hooks/useBook";
import { PrintFlipViewer } from "@/components/books/PrintFlipViewer";

interface PreviewBook {
  title: string;
  coverUrl?: string | null;
  backCoverUrl?: string | null;
  genre?: string | null;
  printWidthMm?: number | null;
  printHeightMm?: number | null;
  printFormatKey?: string | null;
}

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
  const router = useRouter();
  const { apiFetch, token } = useApi();
  const { book } = useBook<PreviewBook>(id);
  const [state, setState] = useState<PrintPreviewStatus | null>(null);
  const [error, setError] = useState("");
  const [grayscale, setGrayscale] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Same source of truth as the cover editor and "Вихідні дані" (T-2076) --
  // books range from pocket (~0.605 width/height) to large (~0.759), and the
  // flipbook must show each book at ITS real trim, not one fixed shape.
  const trimMm = useMemo(
    () => (book ? resolveBookPrintFormat(book) : null),
    [book]
  );

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

  // Передперегляд is reachable from several places (manuscript editor,
  // cover editor, the always-visible sidebar nav item) with no single
  // "home" page -- router.back() returns to wherever the author actually
  // came from, instead of a hardcoded link that's only right some of the
  // time. Falls back to the manuscript editor only if there's no history to
  // go back to (e.g. this page was opened directly / in a fresh tab).
  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(`/dashboard/books/${id}/manuscript`);
    }
  }

  const backLink = (
    <button
      type="button"
      onClick={goBack}
      className="flex items-center gap-2 px-4 py-3 text-[0.875rem] font-medium text-black hover:bg-gray-50"
    >
      <ChevronLeft size={14} className="shrink-0 text-gray-500" />
      Назад
    </button>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200">
        <div className="flex items-center gap-3">
          {backLink}
          {/* T-2057 -- one preview shows the whole book, not just the
              interior pages: the old (retired) preview page led with the
              cover before the pages, this keeps that context. */}
          {book?.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={book.coverUrl}
              alt={`Обкладинка «${book.title}»`}
              className="h-9 w-auto rounded-sm border border-gray-200 shadow-sm"
            />
          )}
        </div>
        {state?.status === "DONE" && (
          <div className="flex items-center gap-1">
            {/* T-2068 -- one shared color/b&w toggle over the same render,
                not a second generated file (Ridero renders two separate
                PDFs for this; a CSS filter gets the same visual result for
                us without doubling worker/storage cost). */}
            <button
              type="button"
              onClick={() => setGrayscale((g) => !g)}
              className="flex items-center gap-1.5 px-3 py-3 text-[0.8125rem] text-gray-500 hover:text-black"
            >
              <Palette size={13} className="shrink-0" />
              {grayscale ? "Кольоровий" : "Чорно-білий"}
            </button>
            {/* T-2057 п.4 -- temporary QA link, byte-for-byte the same file the
                viewer below shows. Remove once the pipeline has a confirmed live
                test (docs/T-2057-checklist.md checklist). */}
            <a
              href={state.printPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-3 text-[0.8125rem] text-gray-500 hover:text-black"
            >
              <Download size={13} className="shrink-0" />
              Завантажити PDF (QA)
            </a>
          </div>
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

        {/* printPageCount should always be set once status is DONE --
            generate-pdf-print.ts (apps/worker) writes it in the same Prisma
            update that sets printPdfUrl, right before this route can ever
            report DONE. Null here means that invariant broke somewhere, not
            "book has 0 pages" -- silently falling back to an empty
            flipbook (printPageCount ?? 0) would hide that from both the
            author and us; surface it instead so a real report points
            straight at this rather than "the preview looks broken". */}
        {!error && state?.status === "DONE" && state.printPageCount == null && (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-red-500">
            Не вдалося визначити кількість сторінок друкованого файлу. Спробуйте оновити сторінку; якщо
            повторюється — повідомте підтримку.
          </div>
        )}

        {!error && state?.status === "DONE" && state.printPageCount != null && (
          <PrintFlipViewer
            printPdfUrl={state.printPdfUrl}
            printPageCount={state.printPageCount}
            coverUrl={book?.coverUrl}
            backCoverUrl={book?.backCoverUrl}
            trimMm={trimMm}
            grayscale={grayscale}
          />
        )}
      </div>
    </div>
  );
}

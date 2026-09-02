"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { resolveBookPrintFormat } from "shared-types";
import { DocxUploader } from "@/components/dashboard/DocxUploader";
import { ManuscriptEditor } from "@/components/manuscript/ManuscriptEditor";
import { AuthorBooksSidebar } from "@/components/dashboard/AuthorBooksSidebar";
import { useBook } from "@/hooks/useBook";
import { useApi } from "@/hooks/useApi";

interface ManuscriptBook {
  title: string;
  subtitle?: string | null;
  description?: string | null;
  genre?: string | null;
  printWidthMm?: number | null;
  printHeightMm?: number | null;
  printFormatKey?: string | null;
  ageRating?: string | null;
  isbn?: string | null;
  udcCode?: string | null;
  bbkCode?: string | null;
  authorSign?: string | null;
  pageCount?: number | null;
  createdAt?: string | null;
  originalDocxUrl?: string | null;
  docxUpdatedAt?: string | null;
  manuscriptImportedAt?: string | null;
  author?: { name: string } | null;
}

type ManuscriptStatus =
  | { status: "NO_DOCX" }
  | { status: "PROCESSING"; progress?: number }
  | { status: "DONE"; content: any; styleOverrides: Record<string, any> };

export default function ManuscriptEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { apiFetch, token } = useApi();
  const { book, setBook, loading, refetch } = useBook<ManuscriptBook>(id);
  // Same source of truth as the print PDF and cover editor (T-2076) -- the
  // editor's own page-format check must reflect this book's REAL trim, not
  // a fixed constant.
  const printFormat = useMemo(() => (book ? resolveBookPrintFormat(book) : null), [book]);
  const [manuscript, setManuscript] = useState<ManuscriptStatus | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [showReimportConfirm, setShowReimportConfirm] = useState(false);
  const [reimporting, setReimporting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // A newer .docx was uploaded (DocxUploader / RepublishButton flow) after
  // the manuscript editor's content was last imported -- manuscriptContent
  // is otherwise never re-synced automatically (would silently clobber any
  // in-editor edits), so surface it and let the author opt in explicitly.
  const needsReimport =
    !!book?.docxUpdatedAt &&
    !!book?.manuscriptImportedAt &&
    new Date(book.docxUpdatedAt).getTime() > new Date(book.manuscriptImportedAt).getTime();

  async function confirmReimport() {
    setReimporting(true);
    try {
      await apiFetch(`/api/books/${id}/manuscript/reimport`, { method: "POST" });
      setShowReimportConfirm(false);
      setManuscript(null); // re-enters the PROCESSING/poll screen below, same as a first import
    } finally {
      setReimporting(false);
    }
  }

  const poll = useCallback(async () => {
    const res = await apiFetch<ManuscriptStatus>(`/api/books/${id}/manuscript`).catch(() => null);
    if (!res) return;
    setManuscript(res);
    if (res.status !== "PROCESSING" && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [id, apiFetch]);

  useEffect(() => {
    if (!token || !book?.originalDocxUrl || manuscript?.status === "DONE") return;
    poll();
    pollRef.current = setInterval(poll, 3000);
    setElapsed(0);
    tickRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [token, book?.originalDocxUrl, poll, manuscript?.status]);

  useEffect(() => {
    if (manuscript?.status === "DONE" && tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, [manuscript?.status]);

  // Keep book.manuscriptImportedAt/docxUpdatedAt current once an import
  // finishes -- otherwise needsReimport above would keep computing off the
  // stale value fetched before this import even started, and the banner
  // wouldn't clear after the author's own reimport.
  useEffect(() => {
    if (manuscript?.status === "DONE") refetch({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manuscript?.status]);

  if (loading) {
    return (
      <div className="flex h-full overflow-hidden">
        <AuthorBooksSidebar />
        <div className="flex-1 overflow-y-auto p-8">
          <div className="h-96 max-w-3xl animate-pulse rounded-xl bg-gray-100" />
        </div>
      </div>
    );
  }

  if (!book?.originalDocxUrl) {
    return (
      <div className="flex h-full overflow-hidden">
        <AuthorBooksSidebar />
        <div className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-2xl">
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <h1 className="mb-4 text-lg font-semibold text-gray-900">Рукопис (.docx)</h1>
              <DocxUploader
                bookId={id}
                currentDocxUrl={book?.originalDocxUrl}
                onUploadSuccess={() => {
                  setBook((b) => (b ? { ...b, originalDocxUrl: "uploaded" } : b));
                }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!manuscript || manuscript.status !== "DONE") {
    const progress = manuscript?.status === "PROCESSING" ? manuscript.progress ?? 0 : 0;
    return (
      <div className="flex h-full overflow-hidden">
        <AuthorBooksSidebar />
        <div className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-2xl">
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-white p-16 shadow-sm">
              <p className="text-sm text-gray-700">Імпортуємо рукопис у редактор…</p>
              <div className="relative h-1.5 w-64 overflow-hidden rounded-full bg-gray-200">
                {progress > 0 ? (
                  <div
                    className="absolute top-0 h-full rounded-full bg-gray-900 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                ) : (
                  <div className="progress-indeterminate-bar absolute top-0 h-full rounded-full bg-gray-900" />
                )}
              </div>
              <p className="text-xs text-gray-400">
                {progress > 0 ? `${progress}% — ` : ""}
                {elapsed}с — зазвичай це займає менше хвилини
                {elapsed >= 45 && " (великий файл може тривати довше — не закривайте сторінку)"}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {needsReimport && (
        <div className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5">
          <p className="text-sm text-amber-900">
            Ви завантажили новіший файл рукопису (.docx). Текст у редакторі нижче — досі зі старого файлу.
          </p>
          <button
            type="button"
            onClick={() => setShowReimportConfirm(true)}
            className="shrink-0 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
          >
            Оновити текст з нового файлу
          </button>
        </div>
      )}

      {showReimportConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold text-gray-900">Оновити текст з нового файлу?</h2>
            <p className="mt-2 text-sm text-gray-600">
              Поточний текст і правки в цьому редакторі буде <strong>замінено</strong> текстом з
              щойно завантаженого .docx. Скасувати цю дію після підтвердження не можна.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowReimportConfirm(false)}
                disabled={reimporting}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Скасувати
              </button>
              <button
                type="button"
                onClick={confirmReimport}
                disabled={reimporting}
                className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {reimporting ? "Оновлення…" : "Так, замінити текст"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1">
        <ManuscriptEditor
          bookId={id}
          initialContent={manuscript.content}
          initialStyleOverrides={manuscript.styleOverrides}
          printFormat={printFormat ?? undefined}
        />
      </div>
    </div>
  );
}

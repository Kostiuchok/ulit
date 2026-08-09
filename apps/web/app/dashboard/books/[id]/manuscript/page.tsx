"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DocxUploader } from "@/components/dashboard/DocxUploader";
import { ManuscriptEditor } from "@/components/manuscript/ManuscriptEditor";
import { AuthorBooksSidebar } from "@/components/dashboard/AuthorBooksSidebar";
import { useBook } from "@/hooks/useBook";
import { useApi } from "@/hooks/useApi";

interface ManuscriptBook {
  title: string;
  originalDocxUrl?: string | null;
}

type ManuscriptStatus =
  | { status: "NO_DOCX" }
  | { status: "PROCESSING" }
  | { status: "DONE"; content: any; styleOverrides: Record<string, any> };

export default function ManuscriptEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { apiFetch, token } = useApi();
  const { book, setBook, loading } = useBook<ManuscriptBook>(id);
  const [manuscript, setManuscript] = useState<ManuscriptStatus | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    if (!token || !book?.originalDocxUrl) return;
    poll();
    pollRef.current = setInterval(poll, 3000);
    setElapsed(0);
    tickRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [token, book?.originalDocxUrl, poll]);

  useEffect(() => {
    if (manuscript?.status === "DONE" && tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
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
    return (
      <div className="flex h-full overflow-hidden">
        <AuthorBooksSidebar />
        <div className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-2xl">
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-white p-16 shadow-sm">
              <p className="text-sm text-gray-700">Імпортуємо рукопис у редактор…</p>
              <div className="relative h-1.5 w-64 overflow-hidden rounded-full bg-gray-200">
                <div className="progress-indeterminate-bar absolute top-0 h-full rounded-full bg-gray-900" />
              </div>
              <p className="text-xs text-gray-400">
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
    <div className="h-full">
      <ManuscriptEditor bookId={id} initialContent={manuscript.content} initialStyleOverrides={manuscript.styleOverrides} />
    </div>
  );
}

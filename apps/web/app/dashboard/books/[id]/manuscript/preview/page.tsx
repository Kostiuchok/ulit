"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ManuscriptPagePreview } from "@/components/manuscript/ManuscriptPagePreview";
import { useBook } from "@/hooks/useBook";
import { useApi } from "@/hooks/useApi";

interface PreviewBook {
  title: string;
  coverUrl?: string | null;
  originalDocxUrl?: string | null;
}

type ManuscriptStatus =
  | { status: "NO_DOCX" }
  | { status: "PROCESSING" }
  | { status: "DONE"; content: any };

export default function ManuscriptPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const { apiFetch, token } = useApi();
  const { book, loading } = useBook<PreviewBook>(id);
  const [manuscript, setManuscript] = useState<ManuscriptStatus | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [token, book?.originalDocxUrl, poll, manuscript?.status]);

  const backLink = (
    <Link
      href={`/dashboard/books/${id}/manuscript`}
      className="flex items-center gap-2 px-4 py-3 text-[0.875rem] font-medium text-black hover:bg-gray-50"
    >
      <ChevronLeft size={14} className="shrink-0 text-gray-500" />
      До редактора рукопису
    </Link>
  );

  if (loading || !book?.originalDocxUrl || !manuscript || manuscript.status !== "DONE") {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-gray-200">{backLink}</div>
        <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
          {!book?.originalDocxUrl
            ? "Спочатку завантажте рукопис (.docx)."
            : "Завантаження рукопису для передперегляду…"}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200">{backLink}</div>
      <div className="min-h-0 flex-1">
        <ManuscriptPagePreview bookId={id} coverUrl={book.coverUrl} manuscriptContent={manuscript.content} />
      </div>
    </div>
  );
}

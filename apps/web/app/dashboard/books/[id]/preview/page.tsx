"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApi } from "../../../../../hooks/useApi";
import { BookViewer } from "../../../../../components/books/BookViewer";

interface PageEntry { page: number; url: string }
interface BackCoverData { authorName: string; bio?: string | null; avatarUrl?: string | null }
interface BookInfo { coverUrl?: string | null; pdfUrl?: string | null; title: string }

type PagesResponse =
  | { status: "DONE"; pages: PageEntry[] }
  | { status: "PROCESSING" }
  | { status: "NO_PDF" };

export default function PreviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { apiFetch, token } = useApi();

  const [book, setBook] = useState<BookInfo | null>(null);
  const [pages, setPages] = useState<PageEntry[] | null>(null);
  const [backCover, setBackCover] = useState<BackCoverData | null>(null);
  const [status, setStatus] = useState<"loading" | "processing" | "ready" | "no_pdf">("loading");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!token) return;

    Promise.all([
      apiFetch<{ book: BookInfo }>(`/api/books/${id}`),
      apiFetch<BackCoverData>(`/api/books/${id}/back-cover-data`),
    ]).then(([{ book }, backCoverData]) => {
      setBook(book);
      setBackCover(backCoverData);
    }).catch(() => router.push(`/dashboard/books/${id}`));
  }, [token, id]);

  useEffect(() => {
    if (!token || !book) return;

    const poll = async () => {
      const res = await apiFetch<PagesResponse>(`/api/books/${id}/pages`).catch(() => null);
      if (!res) return;

      if (res.status === "NO_PDF") {
        setStatus("no_pdf");
        if (pollRef.current) clearInterval(pollRef.current);
      } else if (res.status === "DONE") {
        setPages(res.pages);
        setStatus("ready");
        if (pollRef.current) clearInterval(pollRef.current);
      } else {
        setStatus("processing");
      }
    };

    poll();
    pollRef.current = setInterval(poll, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [token, book, id]);

  if (status === "no_pdf") {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="text-center text-white">
          <p className="text-lg mb-4">PDF ще не згенеровано. Спочатку завантажте рукопис.</p>
          <button
            onClick={() => router.push(`/dashboard/books/${id}`)}
            className="px-4 py-2 bg-white text-black rounded"
          >
            Повернутись
          </button>
        </div>
      </div>
    );
  }

  if (status === "processing" || status === "loading") {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        <p className="text-white/60 text-sm">
          {status === "loading" ? "Завантаження…" : "Генерація сторінок…"}
        </p>
        <button
          onClick={() => router.push(`/dashboard/books/${id}`)}
          className="mt-4 text-white/40 hover:text-white/70 text-sm"
        >
          Скасувати
        </button>
      </div>
    );
  }

  if (status === "ready" && pages && backCover) {
    return (
      <BookViewer
        coverUrl={book?.coverUrl}
        pages={pages}
        backCover={backCover}
        onClose={() => router.push(`/dashboard/books/${id}`)}
      />
    );
  }

  return null;
}

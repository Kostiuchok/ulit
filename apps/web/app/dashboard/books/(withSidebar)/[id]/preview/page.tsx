"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { BookViewer } from "@/components/books/BookViewer";

interface PageEntry { page: number; url: string }
interface BackCoverData { authorName: string; bio?: string | null; avatarUrl?: string | null }
interface BookInfo { coverUrl?: string | null; backCoverUrl?: string | null; pdfUrl?: string | null; title: string }

type PagesResponse =
  | { status: "DONE"; pages: PageEntry[]; pagesBw: PageEntry[]; pdfUrl: string | null }
  | { status: "PROCESSING" }
  | { status: "NO_PDF" };

export default function PreviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { apiFetch, token } = useApi();

  const [book, setBook] = useState<BookInfo | null>(null);
  const [pages, setPages] = useState<PageEntry[] | null>(null);
  const [pagesBw, setPagesBw] = useState<PageEntry[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
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
        setPagesBw(res.pagesBw);
        setPdfUrl(res.pdfUrl);
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

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{book?.title ?? "Передперегляд"}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Перевірте верстку, сторінки та обкладинку перед публікацією</p>
        </div>

        {status === "no_pdf" && (
          <div className="bg-white rounded-xl border p-10 text-center space-y-4">
            <p className="text-gray-600">PDF ще не згенеровано. Спочатку завантажте рукопис.</p>
            <button
              onClick={() => router.push(`/dashboard/books/${id}`)}
              className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm"
            >
              Повернутись
            </button>
          </div>
        )}

        {(status === "processing" || status === "loading") && (
          <div className="bg-white rounded-xl border p-16 flex flex-col items-center justify-center gap-4">
            <div className="w-10 h-10 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
            <p className="text-gray-400 text-sm">
              {status === "loading" ? "Завантаження…" : "Генерація сторінок…"}
            </p>
            <button
              onClick={() => router.push(`/dashboard/books/${id}`)}
              className="text-gray-400 hover:text-gray-700 text-sm"
            >
              Скасувати
            </button>
          </div>
        )}

        {status === "ready" && pages && backCover && (
          <BookViewer
            coverUrl={book?.coverUrl}
            backCoverUrl={book?.backCoverUrl}
            pages={pages}
            pagesBw={pagesBw}
            backCover={backCover}
            pdfUrl={pdfUrl}
            onClose={() => router.push(`/dashboard/books/${id}`)}
          />
        )}
      </div>
    </div>
  );
}

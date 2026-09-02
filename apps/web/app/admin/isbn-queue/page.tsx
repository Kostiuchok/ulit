"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useApi } from "../../../hooks/useApi";

interface QueueBook {
  id: string;
  title: string;
  coverUrl?: string | null;
  authorName: string;
  authorFullName: string | null;
  printPageCount?: number | null;
  publishedAt?: string | null;
}

interface IsbnPackage {
  title: string;
  authorFullName: string | null;
  annotationTxtUrl: string;
  manuscriptPdfUrl: string;
  coverUrl: string | null;
  backCoverUrl: string | null;
  genre: string | null;
  language: string;
  printPageCount: number | null;
}

export default function IsbnQueuePage() {
  const { apiFetch, token } = useApi();
  const [books, setBooks] = useState<QueueBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pkg, setPkg] = useState<IsbnPackage | null>(null);
  const [pkgLoading, setPkgLoading] = useState(false);
  const [pkgError, setPkgError] = useState("");
  const [annotationLoading, setAnnotationLoading] = useState(false);

  // annotation.txt is a direct admin-gated API route (not a pre-signed URL
  // like the other two links), so a plain <a href> would 401 without the
  // bearer token -- same authenticated-blob-download pattern as
  // admin/books/page.tsx's downloadFile().
  async function downloadAnnotation(url: string, bookTitle: string) {
    setAnnotationLoading(true);
    try {
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `${bookTitle}-annotation.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch (e: any) {
      alert(`Помилка завантаження: ${e.message}`);
    } finally {
      setAnnotationLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    apiFetch<{ books: QueueBook[] }>("/api/admin/isbn-queue")
      .then((d) => setBooks(d.books))
      .finally(() => setLoading(false));
  }, [token]);

  async function toggleOpen(id: string) {
    if (openId === id) {
      setOpenId(null);
      setPkg(null);
      return;
    }
    setOpenId(id);
    setPkg(null);
    setPkgError("");
    setPkgLoading(true);
    try {
      const data = await apiFetch<IsbnPackage>(`/api/admin/books/${id}/isbn-package`);
      setPkg(data);
    } catch (e: any) {
      setPkgError(e.message || "Не вдалося зібрати пакет файлів");
    } finally {
      setPkgLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Реєстрація ISBN</h1>
        <p className="text-sm text-gray-500 mt-1">
          Книги, що пройшли модерацію, ще не подані до Книжкової палати і мають усі дані, потрібні для подання —
          готові до відправки зовнішнім каналом.
        </p>
      </div>

      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 animate-pulse">Завантаження…</div>
        ) : books.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-4xl mb-3">✅</p>
            <p className="text-gray-500">Черга порожня — немає книг, готових до подання на ISBN</p>
          </div>
        ) : (
          <ul className="divide-y">
            {books.map((book) => (
              <li key={book.id}>
                <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                  {book.coverUrl ? (
                    <img src={book.coverUrl} alt="" className="h-12 w-8 rounded object-cover" />
                  ) : (
                    <div className="h-12 w-8 rounded bg-gray-100 flex items-center justify-center text-sm">📖</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{book.title}</p>
                    <p className="text-xs text-gray-500">
                      {book.authorFullName || book.authorName}
                      {book.printPageCount ? ` · ${book.printPageCount} стор.` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleOpen(book.id)}
                    className="rounded-md bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                  >
                    {openId === book.id ? "Сховати файли" : "Показати файли →"}
                  </button>
                </div>

                {openId === book.id && (
                  <div className="px-4 pb-4 bg-gray-50 border-t">
                    {pkgLoading && <p className="text-sm text-gray-400 pt-3">Готуємо посилання…</p>}
                    {pkgError && <p className="text-sm text-red-600 pt-3">{pkgError}</p>}
                    {pkg && (
                      <div className="pt-3 space-y-3">
                        <p className="text-xs text-gray-500">
                          Автор: <span className="font-medium text-gray-700">{pkg.authorFullName || "—"}</span> · Мова:{" "}
                          {pkg.language} · Жанр: {pkg.genre || "—"} · Сторінок: {pkg.printPageCount ?? "—"}. Пакет
                          покриває і ISBN, і УДК + авторський знак («шифр зберігання») — та сама установа, ті самі дані.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={annotationLoading}
                            onClick={() => downloadAnnotation(pkg.annotationTxtUrl, book.title)}
                            className="rounded-md border bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                          >
                            📄 Файл 1 — заявка (.txt)
                          </button>
                          <a
                            href={pkg.manuscriptPdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-md border bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                          >
                            📘 Файл 2 — рукопис (PDF)
                          </a>
                          {pkg.coverUrl && (
                            <a
                              href={pkg.coverUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-md border bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                            >
                              🖼 Файл 3 — обкладинка (перед)
                            </a>
                          )}
                          {pkg.backCoverUrl && (
                            <a
                              href={pkg.backCoverUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-md border bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                            >
                              🖼 Файл 4 — обкладинка (зад)
                            </a>
                          )}
                        </div>
                        <p className="text-xs text-gray-400">
                          Заявку на УДК + авторський знак надсилати на{" "}
                          <code className="text-[0.6875rem]">udc2920054@ukr.net</code>, тема листа:{" "}
                          <code className="text-[0.6875rem]">«УДК, [назва видавця]»</code>.
                        </p>
                        <Link
                          href={`/admin/books/${book.id}/distribute`}
                          className="inline-block text-xs text-blue-700 underline hover:no-underline"
                        >
                          Перейти до розділу «Реєстрація ISBN» книги, щоб позначити подання →
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

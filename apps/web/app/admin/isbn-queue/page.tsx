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

const UDC_EMAIL = "udc2920054@ukr.net";

// mailto: can't carry attachments (browser/OS limitation, not a design
// choice) -- this pre-fills recipient/subject/body so the admin only has to
// attach the 4 downloaded files themselves before hitting send in their own
// mail client, instead of typing everything from scratch.
function buildUdcMailtoHref(book: QueueBook, pkg: IsbnPackage) {
  const subject = `УДК, ${book.title}`;
  const body =
    `Назва книги: ${book.title}\r\n` +
    `Автор (ПІБ): ${pkg.authorFullName || book.authorFullName || book.authorName}\r\n` +
    `Мова видання: ${pkg.language}\r\n` +
    `Жанр: ${pkg.genre || "—"}\r\n` +
    `Кількість сторінок: ${pkg.printPageCount ?? "—"}\r\n\r\n` +
    `До листа додайте вручну 4 файли, завантажені нижче (заявка, рукопис, обкладинки) —\r\n` +
    `mailto-посилання не може додавати вкладення автоматично.`;
  return `mailto:${UDC_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function IsbnQueuePage() {
  const { apiFetch, token } = useApi();
  const [books, setBooks] = useState<QueueBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [pkgs, setPkgs] = useState<Record<string, IsbnPackage>>({});
  const [pkgLoading, setPkgLoading] = useState<Record<string, boolean>>({});
  const [pkgErrors, setPkgErrors] = useState<Record<string, string>>({});
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [annotationLoadingId, setAnnotationLoadingId] = useState<string | null>(null);

  // annotation.txt is a direct admin-gated API route (not a pre-signed URL
  // like the other two links), so a plain <a href> would 401 without the
  // bearer token -- same authenticated-blob-download pattern as
  // admin/books/page.tsx's downloadFile().
  async function downloadAnnotation(id: string, url: string, bookTitle: string) {
    setAnnotationLoadingId(id);
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
      setAnnotationLoadingId(null);
    }
  }

  useEffect(() => {
    if (!token) return;
    apiFetch<{ books: QueueBook[] }>("/api/admin/isbn-queue")
      .then((d) => setBooks(d.books))
      .finally(() => setLoading(false));
  }, [token]);

  // Show every book's package by default (admin used to have to click
  // "Показати файли" per book) -- fetched once each as soon as the queue
  // loads, no click needed. "Сховати файли" still lets the admin collapse
  // a row without re-fetching if they reopen it.
  useEffect(() => {
    if (!token || books.length === 0) return;
    books.forEach((book) => {
      if (pkgs[book.id] || pkgLoading[book.id]) return;
      setPkgLoading((p) => ({ ...p, [book.id]: true }));
      apiFetch<IsbnPackage>(`/api/admin/books/${book.id}/isbn-package`)
        .then((data) => setPkgs((p) => ({ ...p, [book.id]: data })))
        .catch((e: any) => setPkgErrors((p) => ({ ...p, [book.id]: e.message || "Не вдалося зібрати пакет файлів" })))
        .finally(() => setPkgLoading((p) => ({ ...p, [book.id]: false })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, books]);

  function toggleCollapsed(id: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
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
            {books.map((book) => {
              const collapsed = collapsedIds.has(book.id);
              const pkg = pkgs[book.id];
              return (
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
                      onClick={() => toggleCollapsed(book.id)}
                      className="rounded-md bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                    >
                      {collapsed ? "Показати файли →" : "Сховати файли"}
                    </button>
                  </div>

                  {!collapsed && (
                    <div className="px-4 pb-4 bg-gray-50 border-t">
                      {pkgLoading[book.id] && <p className="text-sm text-gray-400 pt-3">Готуємо файли…</p>}
                      {pkgErrors[book.id] && <p className="text-sm text-red-600 pt-3">{pkgErrors[book.id]}</p>}
                      {pkg && (
                        <div className="pt-3 space-y-3">
                          <p className="text-xs text-gray-500">
                            Автор: <span className="font-medium text-gray-700">{pkg.authorFullName || "—"}</span> ·
                            Мова: {pkg.language} · Жанр: {pkg.genre || "—"} · Сторінок: {pkg.printPageCount ?? "—"}.
                            Пакет покриває і ISBN, і УДК + авторський знак («шифр зберігання») — та сама установа, ті
                            самі дані.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={annotationLoadingId === book.id}
                              onClick={() => downloadAnnotation(book.id, pkg.annotationTxtUrl, book.title)}
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
                          <div className="flex flex-wrap items-center gap-2">
                            <a href={buildUdcMailtoHref(book, pkg)}>
                              <button
                                type="button"
                                className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                              >
                                ✉ Написати лист на УДК (тема й текст вже заповнені)
                              </button>
                            </a>
                            <p className="text-xs text-gray-400">
                              Відкриє поштовий клієнт з готовим листом на <code className="text-[0.6875rem]">{UDC_EMAIL}</code> —
                              файли вище додайте вкладенням вручну (mailto не вміє додавати вкладення).
                            </p>
                          </div>
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
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

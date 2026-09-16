"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useApi } from "../../../../hooks/useApi";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { Card } from "../../../../components/ui/card";
import { cn } from "../../../../lib/utils";

interface Book {
  id: string;
  title: string;
  slug: string;
  status: string;
  moderationStatus: string;
  isbn: string | null;
  coverUrl: string | null;
  pdfUrl: string | null;
  epubUrl: string | null;
  fb2Url: string | null;
  mobiUrl: string | null;
  printPdfUrl: string | null;
  priceEbook: string | null;
  pricePrint: string | null;
  pricePrintHardcover: string | null;
  genre: string | null;
  language: string;
  distributionStrategy: string;
  d2dStatus: string;
  kdpStatus: string;
  googleStatus: string;
  createdAt: string;
  publishedAt: string | null;
}

interface AuthorDetail {
  id: string;
  name: string;
  email: string;
  slug: string;
  avatarUrl: string | null;
  bio: string | null;
  role: string;
  contractAcceptedAt: string | null;
  contractAcceptedIp: string | null;
  createdAt: string;
  _count: { books: number; orders: number };
  books: Book[];
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  DRAFT:      { label: "Чернетка",     cls: "bg-gray-100 text-gray-600 hover:bg-gray-100" },
  PROCESSING: { label: "Обробка",      cls: "bg-blue-100 text-blue-700 hover:bg-blue-100" },
  REVIEW:     { label: "На модерації", cls: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100" },
  PUBLISHED:  { label: "Опубліковано", cls: "bg-green-100 text-green-700 hover:bg-green-100" },
  ARCHIVED:   { label: "Архів",        cls: "bg-gray-200 text-gray-500 hover:bg-gray-200" },
};

const EXT_LABELS: Record<string, string> = {
  NOT_SENT:  "—",
  SENT:      "Надіслано",
  PUBLISHED: "Опубліковано",
  ERROR:     "Помилка",
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] ?? { label: status, cls: "bg-gray-100 text-gray-600 hover:bg-gray-100" };
  return (
    <Badge className={cn("rounded-full border-transparent font-medium", s.cls)}>
      {s.label}
    </Badge>
  );
}

interface SignedUrls {
  pdf: string | null;
  epub: string | null;
  fb2: string | null;
  mobi: string | null;
  printPdf: string | null;
}

function DownloadSection({ bookId, hasFiles }: { bookId: string; hasFiles: boolean }) {
  const { apiFetch } = useApi();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [urls, setUrls] = useState<SignedUrls | null>(null);

  const fetchUrls = useCallback(async () => {
    if (urls) return;
    setLoading(true);
    try {
      const data = await apiFetch<SignedUrls>(`/api/admin/books/${bookId}/signed-urls`);
      setUrls(data);
    } finally {
      setLoading(false);
    }
  }, [bookId, urls, apiFetch]);

  if (!hasFiles) return <span className="text-xs text-gray-400">Файли відсутні</span>;

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => { setOpen((v) => !v); if (!open) fetchUrls(); }}
        className="h-auto gap-1 border-blue-200 px-2 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
      >
        {open ? "▲" : "▼"} Завантажити файли
      </Button>
      {open && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {loading ? (
            <span className="text-xs text-gray-400">Генерація посилань…</span>
          ) : urls ? (
            <div className="space-y-2">
              <div className="rounded bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs text-amber-800 font-medium">
                ⏳ Посилання дійсні <strong>48 годин</strong> — збережіть файли одразу.
              </div>
              <div className="flex flex-wrap gap-1.5">
                {([
                  { key: "pdf",      label: "PDF" },
                  { key: "epub",     label: "EPUB" },
                  { key: "fb2",      label: "FB2" },
                  { key: "mobi",     label: "MOBI" },
                  { key: "printPdf", label: "Print PDF" },
                ] as const).map(({ key, label }) =>
                  urls[key] ? (
                    <Button key={key} asChild variant="outline" size="sm" className="h-auto gap-1 border-blue-200 px-2 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-50">
                      <a href={urls[key]!} target="_blank" rel="noopener noreferrer">
                        ↓ {label}
                      </a>
                    </Button>
                  ) : (
                    <span key={key} className="text-gray-300 text-xs">{label}</span>
                  )
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function AdminAuthorDetailPage() {
  const params = useParams<{ id: string }>();
  const { apiFetch, token } = useApi();
  const [author, setAuthor] = useState<AuthorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    apiFetch<{ author: AuthorDetail }>(`/api/admin/authors/${params.id}`)
      .then((d) => setAuthor(d.author))
      .catch(() => setError("Автора не знайдено"))
      .finally(() => setLoading(false));
  }, [token, params.id]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-64" />
        <div className="h-48 bg-gray-200 rounded" />
        <div className="h-64 bg-gray-200 rounded" />
      </div>
    );
  }

  if (error || !author) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p>{error || "Автора не знайдено"}</p>
        <Link href="/admin/authors" className="mt-4 text-sm text-blue-600 hover:underline">
          ← Назад до авторів
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin/authors" className="hover:text-gray-900">Автори</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{author.name}</span>
      </div>

      {/* Author profile card */}
      <Card className="p-6 shadow-sm">
        <div className="flex items-start gap-6">
          {author.avatarUrl ? (
            <img src={author.avatarUrl} alt="" className="h-20 w-20 rounded-full object-cover shrink-0 ring-2 ring-border" />
          ) : (
            <div className="h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center text-3xl shrink-0">👤</div>
          )}
          <div className="flex-1 space-y-1">
            <h1 className="text-xl font-bold text-gray-900">{author.name}</h1>
            <p className="text-sm text-gray-500">{author.email}</p>
            <p className="text-xs text-gray-400">ulit.ua/authors/{author.slug}</p>
            {author.bio && <p className="text-sm text-gray-600 mt-2">{author.bio}</p>}
          </div>
          <div className="text-right space-y-1 text-sm text-gray-500 shrink-0">
            <p><span className="font-semibold text-gray-900">{author._count.books}</span> книг</p>
            <p><span className="font-semibold text-gray-900">{author._count.orders}</span> замовлень</p>
            <p className="text-xs">З {new Date(author.createdAt).toLocaleDateString("uk-UA")}</p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Договір</p>
            {author.contractAcceptedAt ? (
              <div>
                <Badge className="rounded-full border-transparent bg-green-100 font-medium text-green-700 hover:bg-green-100">
                  ✓ Підписано {new Date(author.contractAcceptedAt).toLocaleDateString("uk-UA")}
                </Badge>
                {author.contractAcceptedIp && (
                  <p className="text-xs text-gray-400 mt-0.5">IP: {author.contractAcceptedIp}</p>
                )}
              </div>
            ) : (
              <Badge className="rounded-full border-transparent bg-red-100 font-medium text-red-700 hover:bg-red-100">
                ✕ Не підписано
              </Badge>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Роль</p>
            <Badge variant="secondary" className="rounded-full font-medium text-gray-700 hover:bg-secondary">
              {author.role}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Books */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Книги ({author.books.length})
        </h2>

        {author.books.length === 0 ? (
          <Card className="p-8 text-center text-gray-400 shadow-none">
            Автор ще не додав жодної книги
          </Card>
        ) : (
          <div className="space-y-3">
            {author.books.map((book) => (
              <Card key={book.id} className="p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  {book.coverUrl ? (
                    <img src={book.coverUrl} alt="" className="h-20 w-14 rounded object-cover shrink-0 border" />
                  ) : (
                    <div className="h-20 w-14 rounded border bg-gray-100 flex items-center justify-center text-2xl shrink-0">📚</div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-gray-900">{book.title}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {book.genre && <span>{book.genre} · </span>}
                          {book.language.toUpperCase()}
                          {book.isbn && <span> · ISBN: {book.isbn}</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={book.status} />
                        <Button asChild size="sm" variant="outline" className="text-xs">
                          <Link href={`/admin/books/${book.id}/distribute`}>Дистрибуція</Link>
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3">
                      <DownloadSection
                        bookId={book.id}
                        hasFiles={!!(book.pdfUrl || book.epubUrl || book.fb2Url || book.mobiUrl || book.printPdfUrl)}
                      />
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-3 text-xs text-gray-500">
                      <div>
                        <span className="text-gray-400">D2D: </span>
                        {EXT_LABELS[book.d2dStatus] ?? book.d2dStatus}
                      </div>
                      <div>
                        <span className="text-gray-400">KDP: </span>
                        {EXT_LABELS[book.kdpStatus] ?? book.kdpStatus}
                      </div>
                      <div>
                        <span className="text-gray-400">Google: </span>
                        {EXT_LABELS[book.googleStatus] ?? book.googleStatus}
                      </div>
                    </div>

                    <div className="mt-2 flex gap-4 text-xs text-gray-400">
                      {book.priceEbook && <span>Е-книга: {book.priceEbook} грн</span>}
                      {book.pricePrint && <span>Друк (м&apos;яка): {book.pricePrint} грн</span>}
                      {book.pricePrintHardcover && <span>Друк (тверда): {book.pricePrintHardcover} грн</span>}
                      <span>Додано: {new Date(book.createdAt).toLocaleDateString("uk-UA")}</span>
                      {book.publishedAt && (
                        <span>Опубліковано: {new Date(book.publishedAt).toLocaleDateString("uk-UA")}</span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

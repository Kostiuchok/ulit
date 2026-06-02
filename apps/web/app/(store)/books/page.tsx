import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { StoreBookCard, type StoreBook } from "../../../components/store/StoreBookCard";
import { SearchBar } from "../../../components/store/SearchBar";

export const metadata: Metadata = {
  title: "Каталог книг",
  description: "Всі книги від українських авторів — електронні та друковані формати, різні жанри.",
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const FORMATS = [
  { value: "", label: "Всі формати" },
  { value: "EPUB", label: "EPUB" },
  { value: "FB2", label: "FB2" },
  { value: "MOBI", label: "MOBI" },
  { value: "PRINT", label: "Друк" },
];

interface PageProps {
  searchParams: { q?: string; genre?: string; language?: string; format?: string; cursor?: string };
}

async function fetchBooks(params: URLSearchParams) {
  try {
    const res = await fetch(`${API_URL}/api/store/books?${params.toString()}`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return { books: [] as StoreBook[], nextCursor: null as string | null };
    return res.json() as Promise<{ books: StoreBook[]; nextCursor: string | null }>;
  } catch {
    return { books: [] as StoreBook[], nextCursor: null as string | null };
  }
}

async function fetchGenres(): Promise<string[]> {
  try {
    const res = await fetch(`${API_URL}/api/store/genres`, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.genres ?? [];
  } catch {
    return [];
  }
}

export default async function CatalogPage({ searchParams }: PageProps) {
  const { q, genre, language, format, cursor } = searchParams;

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (genre) params.set("genre", genre);
  if (language) params.set("language", language);
  if (format) params.set("format", format);
  if (cursor) params.set("cursor", cursor);
  params.set("take", "24");

  const [{ books, nextCursor }, genres] = await Promise.all([fetchBooks(params), fetchGenres()]);

  const isFiltered = !!(q || genre || language || format);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Каталог книг</h1>
        <Suspense>
          <SearchBar initialValue={q ?? ""} />
        </Suspense>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar filters */}
        <aside className="w-full md:w-56 shrink-0">
          <div className="rounded-xl border bg-white p-4 shadow-sm space-y-6">
            {/* Format */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Формат</p>
              <div className="space-y-1">
                {FORMATS.map((f) => {
                  const active = (format ?? "") === f.value;
                  const newParams = new URLSearchParams(params.toString());
                  if (f.value) newParams.set("format", f.value);
                  else newParams.delete("format");
                  newParams.delete("cursor");
                  return (
                    <Link
                      key={f.value}
                      href={`/books?${newParams.toString()}`}
                      className={`block rounded-md px-3 py-1.5 text-sm transition-colors ${
                        active
                          ? "bg-gray-900 text-white font-medium"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {f.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Genres */}
            {genres.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Жанр</p>
                <div className="space-y-1">
                  <Link
                    href={`/books?${(() => { const p = new URLSearchParams(params.toString()); p.delete("genre"); p.delete("cursor"); return p.toString(); })()}`}
                    className={`block rounded-md px-3 py-1.5 text-sm transition-colors ${
                      !genre ? "bg-gray-900 text-white font-medium" : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    Всі жанри
                  </Link>
                  {genres.map((g) => {
                    const active = genre === g;
                    const newParams = new URLSearchParams(params.toString());
                    newParams.set("genre", g);
                    newParams.delete("cursor");
                    return (
                      <Link
                        key={g}
                        href={`/books?${newParams.toString()}`}
                        className={`block rounded-md px-3 py-1.5 text-sm transition-colors ${
                          active
                            ? "bg-gray-900 text-white font-medium"
                            : "text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        {g}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Language */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Мова</p>
              <div className="space-y-1">
                {[
                  { value: "", label: "Всі мови" },
                  { value: "uk", label: "Українська" },
                  { value: "en", label: "English" },
                ].map((l) => {
                  const active = (language ?? "") === l.value;
                  const newParams = new URLSearchParams(params.toString());
                  if (l.value) newParams.set("language", l.value);
                  else newParams.delete("language");
                  newParams.delete("cursor");
                  return (
                    <Link
                      key={l.value}
                      href={`/books?${newParams.toString()}`}
                      className={`block rounded-md px-3 py-1.5 text-sm transition-colors ${
                        active
                          ? "bg-gray-900 text-white font-medium"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {l.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            {isFiltered && (
              <Link
                href="/books"
                className="block text-center rounded-md border px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                Скинути фільтри
              </Link>
            )}
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1">
          {q && (
            <p className="mb-4 text-sm text-gray-600">
              Результати пошуку за: <strong className="text-gray-900">«{q}»</strong>
              {" "}— знайдено {books.length} книг{books.length !== 1 ? "" : "у"}
            </p>
          )}

          {books.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">📭</div>
              <p className="text-gray-500 text-lg">Книг не знайдено</p>
              {isFiltered && (
                <Link href="/books" className="mt-4 inline-block text-sm text-gray-500 underline hover:text-gray-700">
                  Скинути фільтри
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {books.map((book) => (
                  <StoreBookCard key={book.id} book={book} />
                ))}
              </div>

              {/* Pagination */}
              <div className="mt-8 flex items-center justify-between">
                {cursor ? (
                  <Link
                    href={`/books?${(() => {
                      const p = new URLSearchParams(params.toString());
                      p.delete("cursor");
                      return p.toString();
                    })()}`}
                    className="rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm"
                  >
                    ← Назад
                  </Link>
                ) : (
                  <div />
                )}
                {nextCursor && (
                  <Link
                    href={`/books?${(() => {
                      const p = new URLSearchParams(params.toString());
                      p.set("cursor", nextCursor);
                      return p.toString();
                    })()}`}
                    className="rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm"
                  >
                    Наступна сторінка →
                  </Link>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

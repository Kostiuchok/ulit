import Link from "next/link";
import { Suspense } from "react";
import { StoreBookCard, type StoreBook } from "../../components/store/StoreBookCard";
import { SearchBar } from "../../components/store/SearchBar";
import { Button } from "../../components/ui/button";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function fetchBooks(params: string): Promise<{ books: StoreBook[]; nextCursor: string | null }> {
  try {
    const res = await fetch(`${API_URL}/api/store/books?${params}`, { next: { revalidate: 60 } });
    if (!res.ok) return { books: [], nextCursor: null };
    return res.json();
  } catch {
    return { books: [], nextCursor: null };
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

function GenreChips({ genres }: { genres: string[] }) {
  if (genres.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {genres.map((g) => (
        <Button
          key={g}
          asChild
          variant="outline"
          size="sm"
          className="rounded-full bg-white text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-900 hover:text-white hover:border-gray-900"
        >
          <Link href={`/books?genre=${encodeURIComponent(g)}`}>{g}</Link>
        </Button>
      ))}
    </div>
  );
}

function BookGrid({ books, title }: { books: StoreBook[]; title: string }) {
  if (books.length === 0) return null;
  return (
    <section>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        <Link href="/books" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
          Всі книги →
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {books.map((book) => (
          <StoreBookCard key={book.id} book={book} />
        ))}
      </div>
    </section>
  );
}

export default async function StorePage() {
  const [newData, popularData, genres] = await Promise.all([
    fetchBooks("take=12"),
    fetchBooks("take=6"),
    fetchGenres(),
  ]);

  return (
    <div>
      {/* Hero banner */}
      <section className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 text-white py-16 px-4">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
            📚 Книги від українських авторів
          </h1>
          <p className="text-lg text-gray-300 mb-8 max-w-2xl mx-auto">
            Відкрийте для себе нові голоси. Підтримайте українських письменників —
            купуйте електронні та друковані книги напряму від авторів.
          </p>
          <div className="flex justify-center gap-3 mb-6">
            <Button asChild variant="outline" className="rounded-full border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white">
              <Link href="/login">Увійти</Link>
            </Button>
            <Button asChild className="rounded-full bg-white text-gray-900 hover:bg-gray-100">
              <Link href="/register">Реєстрація</Link>
            </Button>
          </div>
          <div className="flex justify-center">
            <Suspense>
              <SearchBar />
            </Suspense>
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
            <Button asChild variant="ghost" className="rounded-full bg-white/10 text-white hover:bg-white/20 hover:text-white">
              <Link href="/books?format=EPUB">E-книги</Link>
            </Button>
            <Button asChild variant="ghost" className="rounded-full bg-white/10 text-white hover:bg-white/20 hover:text-white">
              <Link href="/books?format=PRINT">Друковані</Link>
            </Button>
            <Button asChild variant="ghost" className="rounded-full bg-white/10 text-white hover:bg-white/20 hover:text-white">
              <Link href="/books?language=uk">Українською</Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 space-y-12">
        {/* Genres */}
        {genres.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-5">Жанри</h2>
            <GenreChips genres={genres} />
          </section>
        )}

        {/* New books */}
        <BookGrid books={newData.books} title="Нові надходження" />

        {/* CTA for authors */}
        <section className="rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Ви автор?</h2>
          <p className="text-gray-600 mb-6 max-w-lg mx-auto">
            Завантажте свою книгу, отримайте ISBN та почніть продавати вже сьогодні.
            Повний контроль над цінами та правами.
          </p>
          <Button asChild size="lg" className="rounded-full bg-gray-900 hover:bg-gray-700">
            <Link href="/dashboard/books/new">Опублікувати книгу →</Link>
          </Button>
        </section>
      </div>
    </div>
  );
}

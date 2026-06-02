import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { StoreBookCard, type StoreBook } from "../../../../components/store/StoreBookCard";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface AuthorDetail {
  id: string;
  name: string;
  slug: string;
  bio?: string | null;
  avatarUrl?: string | null;
  createdAt: string;
  books: StoreBook[];
}

async function fetchAuthor(slug: string): Promise<AuthorDetail | null> {
  try {
    const res = await fetch(`${API_URL}/api/store/authors/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const data = await res.json();
    return data.author ?? null;
  } catch {
    return null;
  }
}

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const author = await fetchAuthor(params.slug);
  if (!author) return { title: "Автор не знайдений" };

  const title = author.name;
  const description = author.bio?.slice(0, 160) ?? `Книги автора ${author.name} на платформі Knyha`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: author.avatarUrl ? [{ url: author.avatarUrl, width: 400, height: 400 }] : [],
      type: "profile",
    },
  };
}

export default async function AuthorPage({ params }: Props) {
  const author = await fetchAuthor(params.slug);
  if (!author) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: author.name,
    description: author.bio ?? undefined,
    image: author.avatarUrl ?? undefined,
    url: `/authors/${author.slug}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
        <Link href="/books" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-8">
          ← Каталог
        </Link>

        {/* Author profile */}
        <div className="rounded-2xl border bg-white shadow-sm p-8 mb-10">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            {author.avatarUrl ? (
              <img
                src={author.avatarUrl}
                alt={author.name}
                className="h-24 w-24 rounded-full object-cover ring-4 ring-gray-100 shrink-0"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gray-100 text-4xl shrink-0">
                👤
              </div>
            )}

            <div className="flex-1">
              <h1 className="text-3xl font-extrabold text-gray-900">{author.name}</h1>
              <p className="mt-1 text-sm text-gray-500">
                На платформі з {new Date(author.createdAt).toLocaleDateString("uk-UA", {
                  month: "long",
                  year: "numeric",
                })}
              </p>
              {author.bio && (
                <p className="mt-4 text-gray-700 leading-relaxed max-w-2xl">{author.bio}</p>
              )}
              <div className="mt-4 inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
                {author.books.length} {author.books.length === 1 ? "книга" : author.books.length < 5 ? "книги" : "книг"}
              </div>
            </div>
          </div>
        </div>

        {/* Books */}
        {author.books.length > 0 ? (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-5">Книги автора</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {author.books.map((book) => (
                <StoreBookCard key={book.id} book={book} />
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <p className="text-4xl mb-3">📭</p>
            <p>Поки що немає опублікованих книг</p>
          </div>
        )}
      </div>
    </>
  );
}

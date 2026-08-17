import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BookCoverAndPurchase } from "../../../../components/store/BookCoverAndPurchase";
import { PRINT_TRIM_SIZE_LABEL } from "shared-types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface BookDetail {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  coverUrl?: string | null;
  backCoverUrl?: string | null;
  priceEbook?: string | null;
  pricePrint?: string | null;
  pricePrintHardcover?: string | null;
  pricePrintBw?: string | null;
  pricePrintHardcoverBw?: string | null;
  genre?: string | null;
  ageRating?: string | null;
  aiGenerated?: boolean;
  aiGeneratedNote?: string | null;
  coAuthors?: { name: string }[] | null;
  language?: string;
  isbn?: string | null;
  pageCount?: number | null;
  publishedAt?: string | null;
  epubUrl?: string | null;
  fb2Url?: string | null;
  mobiUrl?: string | null;
  printPdfUrl?: string | null;
  distributionStrategy?: string;
  author: {
    id: string;
    name: string;
    slug: string;
    avatarUrl?: string | null;
  };
}

async function fetchBook(slug: string): Promise<BookDetail | null> {
  try {
    const res = await fetch(`${API_URL}/api/store/books/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const data = await res.json();
    return data.book ?? null;
  } catch {
    return null;
  }
}

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const book = await fetchBook(params.slug);
  if (!book) return { title: "Книга не знайдена" };

  const title = `${book.title} — ${book.author.name}`;
  const description = book.description?.slice(0, 160) ?? `Книга «${book.title}» автора ${book.author.name}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: book.coverUrl ? [{ url: book.coverUrl, width: 1800, height: 2700 }] : [],
      type: "book",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: book.coverUrl ? [book.coverUrl] : [],
    },
  };
}

const FORMAT_INFO: { key: keyof BookDetail; label: string; desc: string }[] = [
  { key: "epubUrl", label: "EPUB", desc: "Для e-reader, телефону, планшету" },
  { key: "fb2Url", label: "FB2", desc: "FictionBook — популярний у СНД" },
  { key: "mobiUrl", label: "MOBI / AZW3", desc: "Для Amazon Kindle" },
  { key: "printPdfUrl", label: "PDF (друк)", desc: "Висока якість для друку" },
];

const LANGUAGE_NAMES: Record<string, string> = {
  uk: "Українська",
  en: "English",
  de: "Deutsch",
  fr: "Français",
  pl: "Polski",
};

export default async function BookPage({ params }: Props) {
  const book = await fetchBook(params.slug);
  if (!book) notFound();

  const availableFormats = FORMAT_INFO.filter((f) => book[f.key]);
  const hasAnyPrint = !!(book.pricePrint || book.pricePrintHardcover || book.pricePrintBw || book.pricePrintHardcoverBw);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: book.title,
    description: book.description ?? undefined,
    isbn: book.isbn ?? undefined,
    image: book.coverUrl ?? undefined,
    author: {
      "@type": "Person",
      name: book.author.name,
      url: `/authors/${book.author.slug}`,
    },
    inLanguage: book.language ?? "uk",
    numberOfPages: book.pageCount ?? undefined,
    datePublished: book.publishedAt ? book.publishedAt.slice(0, 10) : undefined,
    offers: [
      ...(book.priceEbook
        ? [{
            "@type": "Offer",
            price: Number(book.priceEbook).toFixed(2),
            priceCurrency: "UAH",
            availability: "https://schema.org/InStock",
            name: "Електронна книга",
          }]
        : []),
      ...(book.pricePrint
        ? [{
            "@type": "Offer",
            price: Number(book.pricePrint).toFixed(2),
            priceCurrency: "UAH",
            availability: "https://schema.org/InStock",
            name: "Друкована книга, м'яка обкладинка",
          }]
        : []),
      ...(book.pricePrintHardcover
        ? [{
            "@type": "Offer",
            price: Number(book.pricePrintHardcover).toFixed(2),
            priceCurrency: "UAH",
            availability: "https://schema.org/InStock",
            name: "Друкована книга, тверда обкладинка",
          }]
        : []),
      ...(book.pricePrintBw
        ? [{
            "@type": "Offer",
            price: Number(book.pricePrintBw).toFixed(2),
            priceCurrency: "UAH",
            availability: "https://schema.org/InStock",
            name: "Друкована книга, м'яка обкладинка, чорно-білий друк",
          }]
        : []),
      ...(book.pricePrintHardcoverBw
        ? [{
            "@type": "Offer",
            price: Number(book.pricePrintHardcoverBw).toFixed(2),
            priceCurrency: "UAH",
            availability: "https://schema.org/InStock",
            name: "Друкована книга, тверда обкладинка, чорно-білий друк",
          }]
        : []),
    ],
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Cover */}
          <div className="md:col-span-1">
            <div className="sticky top-20">
              <BookCoverAndPurchase
                bookId={book.id}
                bookSlug={book.slug}
                title={book.title}
                author={book.author.name}
                coverUrl={book.coverUrl}
                backCoverUrl={book.backCoverUrl}
                epubUrl={book.epubUrl}
                fb2Url={book.fb2Url}
                mobiUrl={book.mobiUrl}
                priceEbook={book.priceEbook ? Number(book.priceEbook) : null}
                pricePrint={book.pricePrint ? Number(book.pricePrint) : null}
                pricePrintHardcover={book.pricePrintHardcover ? Number(book.pricePrintHardcover) : null}
                pricePrintBw={book.pricePrintBw ? Number(book.pricePrintBw) : null}
                pricePrintHardcoverBw={book.pricePrintHardcoverBw ? Number(book.pricePrintHardcoverBw) : null}
              />
            </div>
          </div>

          {/* Details */}
          <div className="md:col-span-2 space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              {book.genre && (
                <Link
                  href={`/books?genre=${encodeURIComponent(book.genre)}`}
                  className="inline-block rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200"
                >
                  {book.genre}
                </Link>
              )}
              {book.ageRating && (
                <span className="inline-block rounded-full bg-gray-900 px-2.5 py-1 text-xs font-bold text-white">
                  {book.ageRating}
                </span>
              )}
              {book.aiGenerated && (
                <span
                  className="inline-block rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700"
                  title={book.aiGeneratedNote ?? undefined}
                >
                  🤖 Створено за допомогою ШІ
                </span>
              )}
            </div>

            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight">
                {book.title}
              </h1>
              {book.subtitle && (
                <p className="mt-1 text-lg text-gray-500">{book.subtitle}</p>
              )}
            </div>

            <Link
              href={`/authors/${book.author.slug}`}
              className="flex items-center gap-3 group"
            >
              {book.author.avatarUrl ? (
                <img
                  src={book.author.avatarUrl}
                  alt={book.author.name}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-lg">
                  👤
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500">Автор</p>
                <p className="text-sm font-semibold text-gray-900 group-hover:underline">{book.author.name}</p>
              </div>
            </Link>

            {book.coAuthors && book.coAuthors.length > 0 && (
              <p className="text-sm text-gray-500">
                Над книгою також працювали: {book.coAuthors.map((c) => c.name).join(", ")}
              </p>
            )}

            {/* Meta */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {book.isbn && (
                <div className="rounded-lg border bg-white p-3">
                  <p className="text-xs text-gray-500">ISBN</p>
                  <p className="text-sm font-mono font-semibold text-gray-900">{book.isbn}</p>
                </div>
              )}
              {book.pageCount && (
                <div className="rounded-lg border bg-white p-3">
                  <p className="text-xs text-gray-500">Сторінок</p>
                  <p className="text-sm font-semibold text-gray-900">{book.pageCount}</p>
                </div>
              )}
              {book.language && (
                <div className="rounded-lg border bg-white p-3">
                  <p className="text-xs text-gray-500">Мова</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {LANGUAGE_NAMES[book.language] ?? book.language}
                  </p>
                </div>
              )}
              {book.publishedAt && (
                <div className="rounded-lg border bg-white p-3">
                  <p className="text-xs text-gray-500">Дата публікації</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {new Date(book.publishedAt).toLocaleDateString("uk-UA", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              )}
              {hasAnyPrint && (
                <div className="rounded-lg border bg-white p-3">
                  <p className="text-xs text-gray-500">Розмір книги</p>
                  <p className="text-sm font-semibold text-gray-900">{PRINT_TRIM_SIZE_LABEL}</p>
                </div>
              )}
            </div>

            {/* Description */}
            {book.description && (
              <div className="rounded-xl border bg-white p-5">
                <h2 className="text-base font-semibold text-gray-900 mb-3">Опис</h2>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                  {book.description}
                </p>
              </div>
            )}

            {/* Formats */}
            {availableFormats.length > 0 && (
              <div className="rounded-xl border bg-white p-5">
                <h2 className="text-base font-semibold text-gray-900 mb-3">Доступні формати</h2>
                <div className="grid grid-cols-2 gap-3">
                  {availableFormats.map((f) => (
                    <div key={f.key} className="flex items-start gap-2 rounded-lg border p-3">
                      <span className="mt-0.5 text-green-500">✓</span>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{f.label}</p>
                        <p className="text-xs text-gray-500">{f.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

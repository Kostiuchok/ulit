import Link from "next/link";
import { TabletCoverFrame } from "../books/TabletCoverFrame";
import { PrintedCoverFrame } from "../books/PrintedCoverFrame";

export interface StoreBook {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  coverUrl?: string | null;
  priceEbook?: string | null;
  pricePrint?: string | null;
  pricePrintHardcover?: string | null;
  pricePrintBw?: string | null;
  pricePrintHardcoverBw?: string | null;
  genre?: string | null;
  language?: string;
  epubUrl?: string | null;
  fb2Url?: string | null;
  mobiUrl?: string | null;
  printPdfUrl?: string | null;
  publishedAt?: string | null;
  author: {
    id: string;
    name: string;
    slug: string;
    avatarUrl?: string | null;
  };
}

const FORMAT_BADGES: { key: keyof StoreBook; label: string }[] = [
  { key: "epubUrl", label: "EPUB" },
  { key: "fb2Url", label: "FB2" },
  { key: "mobiUrl", label: "MOBI" },
  { key: "printPdfUrl", label: "Друк" },
];

interface Props {
  book: StoreBook;
  // Catalog format filter drives which presentation mockup the cover is
  // shown in — "друковані" shows the physical printed-book widget, anything
  // else (ebook formats, unfiltered) shows the tablet/e-reader frame — same
  // two frame components already used on the book detail page carousel.
  frame?: "print" | "tablet";
}

export function StoreBookCard({ book, frame = "tablet" }: Props) {
  const lowestPrice = [
    book.priceEbook,
    book.pricePrint,
    book.pricePrintHardcover,
    book.pricePrintBw,
    book.pricePrintHardcoverBw,
  ]
    .filter(Boolean)
    .map(Number)
    .sort((a, b) => a - b)[0];
  const CoverFrame = frame === "print" ? PrintedCoverFrame : TabletCoverFrame;

  return (
    <Link
      href={`/books/${book.slug}`}
      className="group flex flex-col rounded-xl border bg-white shadow-sm hover:shadow-lg transition-shadow overflow-hidden"
    >
      <div className="relative w-full overflow-hidden bg-gray-100">
        <CoverFrame coverUrl={book.coverUrl} />
        {book.genre && (
          <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
            {book.genre}
          </span>
        )}
      </div>

      <div className="flex flex-col flex-1 p-3 gap-1">
        <p className="text-xs text-gray-500 truncate">{book.author.name}</p>
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight">{book.title}</h3>

        <div className="flex flex-wrap gap-1 mt-1">
          {FORMAT_BADGES.filter((f) => book[f.key]).map((f) => (
            <span
              key={f.key}
              className="rounded-sm bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600"
            >
              {f.label}
            </span>
          ))}
        </div>

        <div className="mt-auto pt-2">
          {lowestPrice != null ? (
            <p className="text-sm font-bold text-gray-900">
              від {lowestPrice.toFixed(2)} грн
            </p>
          ) : (
            <p className="text-sm text-gray-400 italic">ціну не вказано</p>
          )}
        </div>
      </div>
    </Link>
  );
}

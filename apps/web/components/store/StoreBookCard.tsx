import Link from "next/link";
import { resolveBookPrintFormat } from "shared-types";
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
  printFormatKey?: string | null;
  printWidthMm?: number | null;
  printHeightMm?: number | null;
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
  // Same source of truth as the book page's own carousel (BookCoverCarousel)
  // -- without this, every printed book rendered inside one fixed-ratio box
  // regardless of its real trim (pocket ~0.605 up to large ~0.759 width/
  // height), so any book whose actual size didn't match that fixed ratio
  // showed letterboxed white bars beside its cover.
  const trimMm =
    frame === "print"
      ? (() => {
          const format = resolveBookPrintFormat(book);
          return { widthMm: format.widthMm, heightMm: format.heightMm };
        })()
      : undefined;

  return (
    <Link href={`/books/${book.slug}`} className="group flex flex-col">
      {/* Preview sits on its own -- no card/overflow-hidden wrapper around it,
          since PrintedCoverFrame's box-shadow and TabletCoverFrame's device
          frame art both need room to render past the cover's own bounds.
          Boxing them in was clipping exactly the shadows that make the
          mockups look good in isolation. Hover lifts the whole preview
          slightly (position, not size) so the shadow reads as depth. */}
      <div className="relative w-full transition-transform duration-300 ease-out group-hover:-translate-y-1.5">
        {frame === "print" ? (
          <PrintedCoverFrame coverUrl={book.coverUrl} trimMm={trimMm} />
        ) : (
          <TabletCoverFrame coverUrl={book.coverUrl} />
        )}
        {book.genre && (
          <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
            {book.genre}
          </span>
        )}
      </div>

      {/* Detached, transparent -- no card background continuing under the
          preview, just text on the page. */}
      <div className="flex flex-col gap-1 pt-3 px-0.5">
        <p className="text-xs text-gray-500 truncate">{book.author.name}</p>
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight group-hover:underline decoration-gray-300 underline-offset-2">
          {book.title}
        </h3>

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

        <div className="mt-1">
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

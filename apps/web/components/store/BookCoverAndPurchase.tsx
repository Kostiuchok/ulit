"use client";

import { useState } from "react";
import { BookCoverCarousel } from "../books/BookCoverCarousel";
import { EpubReader } from "./EpubReader";
import { BookPurchaseWidget } from "./BookPurchaseWidget";

interface Props {
  bookId: string;
  bookSlug: string;
  title: string;
  author: string;
  coverUrl?: string | null;
  backCoverUrl?: string | null;
  epubUrl?: string | null;
  fb2Url?: string | null;
  mobiUrl?: string | null;
  priceEbook?: number | null;
  pricePrint?: number | null;
  pricePrintHardcover?: number | null;
  pricePrintBw?: number | null;
  pricePrintHardcoverBw?: number | null;
}

// Keeps the cover carousel in sync with the format the buyer picks in the
// purchase widget -- selecting "Друкована" there flips the big cover preview
// to the print mockup and vice versa, instead of the two staying independent.
export function BookCoverAndPurchase({
  bookId,
  bookSlug,
  title,
  author,
  coverUrl,
  backCoverUrl,
  epubUrl,
  fb2Url,
  mobiUrl,
  priceEbook,
  pricePrint,
  pricePrintHardcover,
  pricePrintBw,
  pricePrintHardcoverBw,
}: Props) {
  const hasEbook = priceEbook != null;
  const hasPrint = !!(pricePrint || pricePrintHardcover || pricePrintBw || pricePrintHardcoverBw);
  const [format, setFormat] = useState<"ebook" | "print">(hasEbook ? "ebook" : "print");

  return (
    <>
      <div className="w-full max-w-xs mx-auto">
        {coverUrl ? (
          <BookCoverCarousel
            coverUrl={coverUrl}
            backCoverUrl={backCoverUrl}
            hasEbook={hasEbook}
            hasPrint={hasPrint}
            activeKey={format === "ebook" ? "ebook" : "print-front"}
            onActiveKeyChange={(key) => setFormat(key === "ebook" ? "ebook" : "print")}
          />
        ) : (
          <div className="flex aspect-[2/3] w-full items-center justify-center rounded-xl bg-gray-100 text-7xl">
            📖
          </div>
        )}
      </div>

      {epubUrl && (
        <div className="mt-4 flex justify-center">
          <EpubReader
            bookSlug={bookSlug}
            bookTitle={title}
            bookId={bookId}
            bookPrice={priceEbook ?? null}
            bookAuthor={author}
            coverUrl={coverUrl}
          />
        </div>
      )}

      <div className="mt-6">
        <BookPurchaseWidget
          bookId={bookId}
          title={title}
          author={author}
          coverUrl={coverUrl}
          epubUrl={epubUrl}
          fb2Url={fb2Url}
          mobiUrl={mobiUrl}
          priceEbook={priceEbook}
          pricePrint={pricePrint}
          pricePrintHardcover={pricePrintHardcover}
          pricePrintBw={pricePrintBw}
          pricePrintHardcoverBw={pricePrintHardcoverBw}
          format={format}
          onFormatChange={setFormat}
        />
      </div>
    </>
  );
}

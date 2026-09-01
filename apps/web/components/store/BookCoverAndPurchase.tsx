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
  genre?: string | null;
  printWidthMm?: number | null;
  printHeightMm?: number | null;
  printFormatKey?: string | null;
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
  genre,
  printWidthMm,
  printHeightMm,
  printFormatKey,
}: Props) {
  const hasEbook = priceEbook != null;
  const hasPrint = !!(pricePrint || pricePrintHardcover || pricePrintBw || pricePrintHardcoverBw);
  // Carousel's own slide key is the single source of truth (front/back are
  // both "print", so a plain ebook/print format value can't tell them apart
  // -- driving activeKey off just that format used to snap "print-back"
  // straight back to "print-front" on every click, since format never
  // actually changed). `format` for the purchase widget is derived from it;
  // the widget can still push a format change back in, which resets to that
  // format's front slide (handleFormatChange below), same as before.
  const [coverKey, setCoverKey] = useState<string>(hasEbook ? "ebook" : "print-front");
  const format: "ebook" | "print" = coverKey === "ebook" ? "ebook" : "print";

  function handleFormatChange(next: "ebook" | "print") {
    setCoverKey(next === "ebook" ? "ebook" : "print-front");
  }

  return (
    <>
      <div className="w-full max-w-xs mx-auto">
        {coverUrl ? (
          <BookCoverCarousel
            coverUrl={coverUrl}
            backCoverUrl={backCoverUrl}
            hasEbook={hasEbook}
            hasPrint={hasPrint}
            genre={genre}
            printWidthMm={printWidthMm}
            printHeightMm={printHeightMm}
            printFormatKey={printFormatKey}
            activeKey={coverKey}
            onActiveKeyChange={setCoverKey}
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
          onFormatChange={handleFormatChange}
        />
      </div>
    </>
  );
}

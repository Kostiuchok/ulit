"use client";

import "@/lib/pdfJsPolyfills";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import HTMLFlipBook from "react-pageflip-enhanced";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PRINT_TRIM_SIZE_MM, resolveExcerptRange } from "shared-types";
import { Button } from "@/components/ui/button";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface Props {
  printPdfUrl: string;
  previewStart: number | null;
  previewEnd: number | null;
  pageCount: number | null;
  trimMm?: { widthMm: number; heightMm: number } | null;
  bookTitle: string;
  bookPrice?: number | null;
  onBuy?: () => void;
  onClose: () => void;
}

interface FlipEvent {
  data: number;
}

export function PrintExcerptViewer({
  printPdfUrl,
  previewStart,
  previewEnd,
  pageCount,
  trimMm,
  bookTitle,
  bookPrice,
  onBuy,
  onClose,
}: Props) {
  const [pdfPages, setPdfPages] = useState<number | null>(pageCount && pageCount > 0 ? pageCount : null);
  const [portrait, setPortrait] = useState(true);
  const [pageW, setPageW] = useState(280);
  const [current, setCurrent] = useState(0);
  const [showPaywall, setShowPaywall] = useState(false);
  const bookRef = useRef<{ pageFlip: () => { flipPrev: () => void; flipNext: () => void } } | null>(null);

  useEffect(() => {
    function measure() {
      const isPortrait = window.innerWidth < 768;
      setPortrait(isPortrait);
      setPageW(isPortrait ? Math.min(window.innerWidth - 32, 360) : 380);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const effectiveCount = pdfPages ?? pageCount ?? 1;
  const { start, end } = resolveExcerptRange(previewStart, previewEnd, effectiveCount);
  const pages = useMemo(() => {
    const list: number[] = [];
    for (let n = start; n <= end; n++) list.push(n);
    return list;
  }, [start, end]);

  const effectiveTrim = trimMm && trimMm.widthMm > 0 && trimMm.heightMm > 0 ? trimMm : PRINT_TRIM_SIZE_MM;
  const pageH = Math.round(pageW * (effectiveTrim.heightMm / effectiveTrim.widthMm));
  const folio = pages[current] ?? start;

  const goPrev = useCallback(() => {
    setShowPaywall(false);
    bookRef.current?.pageFlip().flipPrev();
  }, []);
  const goNext = useCallback(() => {
    if (current >= pages.length - 1) {
      setShowPaywall(true);
      return;
    }
    bookRef.current?.pageFlip().flipNext();
  }, [current, pages.length]);

  function handleEdgeTap(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width * 0.35) goPrev();
    else if (x > rect.width * 0.65) goNext();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-950 text-white">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-2">
        <p className="max-w-[40%] truncate text-sm font-semibold">{bookTitle}</p>
        <p className="text-xs text-white/70">
          Сторінка {folio}
          {pdfPages ? ` з ${pdfPages}` : ""}
          <span className="ml-2 text-white/40">
            уривок {start}–{end}
          </span>
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onClose} className="border-white/30 bg-transparent text-white hover:bg-white/10">
          ✕ Закрити
        </Button>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-2 py-3">
        <Document
          file={printPdfUrl}
          onLoadSuccess={({ numPages }) => setPdfPages(numPages)}
          loading={<p className="text-sm text-white/50">Завантаження уривка…</p>}
          error={<p className="text-sm text-red-400">Не вдалося завантажити уривок.</p>}
        >
          <div onClick={handleEdgeTap} className="cursor-pointer">
            <HTMLFlipBook
              key={`${pageW}-${portrait}-${pages.join(",")}`}
              ref={bookRef}
              width={pageW}
              height={pageH}
              size="fixed"
              usePortrait={portrait}
              showCover={false}
              drawShadow
              maxShadowOpacity={0.25}
              flippingTime={450}
              mobileScrollSupport
              useMouseEvents
              onFlip={(e: FlipEvent) => {
                setCurrent(e.data);
                setShowPaywall(false);
              }}
              className="mx-auto shadow-lg"
            >
              {pages.map((pageNumber) => (
                <div key={pageNumber} className="h-full w-full bg-white">
                  <Page
                    pageNumber={pageNumber}
                    width={pageW}
                    renderAnnotationLayer={false}
                    renderTextLayer={false}
                    loading={null}
                    error={null}
                  />
                </div>
              ))}
            </HTMLFlipBook>
          </div>
        </Document>

        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={goPrev}
            disabled={current <= 0}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 disabled:opacity-30"
            aria-label="Попередня сторінка"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={goNext}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30"
            aria-label="Наступна сторінка"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {showPaywall && (
          <div className="absolute inset-0 flex flex-col items-center justify-end bg-gradient-to-t from-black via-black/70 to-transparent pb-16">
            <div className="mx-auto max-w-sm space-y-3 px-4 text-center">
              <p className="text-2xl font-bold">Уривок завершено</p>
              <p className="text-sm text-white/80">
                Безкоштовні сторінки {start}–{end} книги «{bookTitle}».
              </p>
              {bookPrice != null && (
                <p className="text-lg font-semibold">Повна версія — {bookPrice.toFixed(2)} грн</p>
              )}
              {onBuy && (
                <Button type="button" onClick={onBuy} className="w-full bg-white text-gray-900 hover:bg-gray-100">
                  Придбати повну версію →
                </Button>
              )}
              <Button type="button" variant="outline" onClick={onClose} className="w-full border-white/40 bg-transparent text-white">
                Закрити
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

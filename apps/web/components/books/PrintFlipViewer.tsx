"use client";

import { useMemo, useRef, useState } from "react";
import HTMLFlipBook from "react-pageflip-enhanced";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PRINT_TRIM_SIZE_MM } from "shared-types";

// react-pdf needs pdf.js's worker as a separate script. The `new URL(...,
// import.meta.url)` form react-pdf's own docs suggest fails Next.js's build
// ('import.meta' cannot be used outside of module code -- Terser processes
// the worker as a plain script, not ESM, since it isn't going through
// Next's own module pipeline). Serving it as a static public asset instead
// (copied fresh from node_modules by scripts/copy-pdf-worker.js on every
// dev/build, see package.json predev/prebuild) sidesteps webpack entirely.
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

// On-screen width of a single page at 1x -- react-pageflip renders a 2-page
// spread (usePortrait=false), so the book is ~2x this wide. Height derives
// from the book's real trim ratio (T-2076's resolveBookPrintFormat), not a
// fixed constant -- pocket/standard/large books all have visibly different
// proportions and must not be squashed into one shape here.
const DISPLAY_W = 420;

// react-pageflip mounts every leaf's children on mount (it manages the flip
// state itself, not a virtualized list) -- for a 92-page book that's 92
// concurrent pdf.js canvas renders if done naively, which is the same class
// of freeze this session hit poking at Ridero's own live 3D viewer on a
// similarly long book. Only the leaves within this many positions of the
// current one get a real <Page>; the rest render an empty placeholder until
// a flip brings them into range.
const RENDER_WINDOW = 4;

interface Props {
  printPdfUrl: string;
  printPageCount: number;
  coverUrl?: string | null;
  trimMm?: { widthMm: number; heightMm: number } | null;
  grayscale?: boolean;
}

interface FlipEvent {
  data: number;
}

type FlipLeaf =
  | { kind: "cover"; url: string }
  | { kind: "blank" }
  | { kind: "page"; pageNumber: number };

export function PrintFlipViewer({ printPdfUrl, printPageCount, coverUrl, trimMm, grayscale = false }: Props) {
  const effectiveTrim = trimMm && trimMm.widthMm > 0 && trimMm.heightMm > 0 ? trimMm : PRINT_TRIM_SIZE_MM;
  const pageW = DISPLAY_W;
  const pageH = Math.round(DISPLAY_W * (effectiveTrim.heightMm / effectiveTrim.widthMm));

  const bookRef = useRef<{ pageFlip: () => { flipPrev: () => void; flipNext: () => void; flip: (i: number) => void } } | null>(null);
  const [current, setCurrent] = useState(0);

  const hasCover = !!coverUrl;

  // Same binding convention as the retired ManuscriptPagePreview.tsx: a
  // closed book's front cover is "page 1" alone, so the interior's own page
  // 1 always lands on the first spread's right (recto) side -- this blank
  // leaf is what pushes it there, with or without a cover set.
  const flipLeaves: FlipLeaf[] = useMemo(
    () => [
      ...(hasCover ? [{ kind: "cover" as const, url: coverUrl! }] : []),
      { kind: "blank" as const },
      ...Array.from({ length: printPageCount }, (_, i) => ({ kind: "page" as const, pageNumber: i + 1 })),
    ],
    [hasCover, coverUrl, printPageCount]
  );
  const totalLeaves = flipLeaves.length;

  function goPrev() {
    bookRef.current?.pageFlip().flipPrev();
  }
  function goNext() {
    bookRef.current?.pageFlip().flipNext();
  }
  function goTo(i: number) {
    bookRef.current?.pageFlip().flip(Math.min(Math.max(0, i), totalLeaves - 1));
  }

  return (
    <div className="flex h-full flex-col items-center gap-4 overflow-y-auto bg-gray-100 py-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={goPrev}
          disabled={current <= 0}
          className="flex h-8 w-8 items-center justify-center rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-1.5 text-sm text-gray-700">
          <input
            type="number"
            min={1}
            max={totalLeaves}
            value={current + 1}
            onChange={(e) => goTo(Number(e.target.value) - 1)}
            className="w-14 rounded border border-gray-300 px-2 py-1 text-center outline-none focus:border-gray-900"
            aria-label="Номер сторінки"
          />
          <span>з {totalLeaves}</span>
        </div>
        <button
          type="button"
          onClick={goNext}
          disabled={current >= totalLeaves - 1}
          className="flex h-8 w-8 items-center justify-center rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div style={{ filter: grayscale ? "grayscale(1)" : "none" }}>
        <Document file={printPdfUrl} loading={null} error={null}>
          <HTMLFlipBook
            ref={bookRef}
            width={pageW}
            height={pageH}
            size="fixed"
            usePortrait={false}
            showCover={hasCover}
            drawShadow
            maxShadowOpacity={0.3}
            flippingTime={500}
            mobileScrollSupport
            useMouseEvents
            onFlip={(e: FlipEvent) => setCurrent(e.data)}
            className="mx-auto shadow-sm"
          >
            {flipLeaves.map((leaf, i) => {
              if (leaf.kind === "blank") {
                return <div key={`blank-${i}`} className="h-full w-full bg-white" />;
              }
              if (leaf.kind === "cover") {
                return (
                  <div key="cover" className="h-full w-full bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={leaf.url} alt="" className="h-full w-full object-cover" loading="eager" />
                  </div>
                );
              }
              const withinRenderWindow = Math.abs(i - current) <= RENDER_WINDOW;
              return (
                <div key={i} className="h-full w-full bg-white">
                  {withinRenderWindow && (
                    <Page
                      pageNumber={leaf.pageNumber}
                      width={pageW}
                      renderAnnotationLayer={false}
                      renderTextLayer={false}
                      loading={null}
                      error={null}
                    />
                  )}
                </div>
              );
            })}
          </HTMLFlipBook>
        </Document>
      </div>
    </div>
  );
}

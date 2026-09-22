"use client";

import "@/lib/pdfJsPolyfills";
import { useEffect, useMemo, useRef, useState } from "react";
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
  backCoverUrl?: string | null;
  trimMm?: { widthMm: number; heightMm: number } | null;
  grayscale?: boolean;
}

interface FlipEvent {
  data: number;
}

type FlipLeaf =
  | { kind: "cover"; url: string }
  | { kind: "blank" }
  | { kind: "page"; pageNumber: number }
  | { kind: "backCover"; url: string };

export function PrintFlipViewer({ printPdfUrl, printPageCount, coverUrl, backCoverUrl, trimMm, grayscale = false }: Props) {
  const effectiveTrim = trimMm && trimMm.widthMm > 0 && trimMm.heightMm > 0 ? trimMm : PRINT_TRIM_SIZE_MM;
  const pageW = DISPLAY_W;
  const pageH = Math.round(DISPLAY_W * (effectiveTrim.heightMm / effectiveTrim.widthMm));

  const bookRef = useRef<{ pageFlip: () => { flipPrev: () => void; flipNext: () => void; flip: (i: number) => void } } | null>(null);
  const [current, setCurrent] = useState(0);
  // The page-number input is its own typed draft, not bound straight to
  // `current` -- an onChange wired directly to goTo() flipped the book after
  // the very first keystroke (typing "12" flips to page 1, then to page 2),
  // making the field unusable for anything but single-digit books. It only
  // commits (flips) on Enter or blur; `current` changing elsewhere (arrows,
  // drag) re-syncs the draft via the effect below.
  const [pageInput, setPageInput] = useState("1");
  useEffect(() => {
    setPageInput(String(current + 1));
  }, [current]);

  function commitPageInput() {
    const n = Number(pageInput);
    if (Number.isFinite(n) && pageInput.trim() !== "") {
      goTo(n - 1);
    } else {
      setPageInput(String(current + 1));
    }
  }

  const hasCover = !!coverUrl;
  const hasBackCover = !!backCoverUrl;

  // Same binding convention as the retired ManuscriptPagePreview.tsx: a
  // closed book's front cover is "page 1" alone, so the interior's own page
  // 1 always lands on the first spread's right (recto) side -- this blank
  // leaf is what pushes it there, with or without a cover set.
  //
  // When there's a back cover, the print PDF (buildManuscriptPrintHtml)
  // already bakes it in as that PDF's literal last page -- rendering it
  // through the same <Page pageNumber> interior-page component every other
  // page uses made it look like just another plain interior page instead of
  // the outside of a closed book. Excluded from the interior page range
  // here and rendered as its own leaf below, the same full-bleed <img>
  // treatment the front cover leaf already gets.
  const interiorPageCount = hasBackCover ? Math.max(0, printPageCount - 1) : printPageCount;

  // react-pageflip's showCover mode (see createSpread() in
  // react-pageflip-enhanced's build/index.js) marks leaf 0 as a lone hard
  // "cover" spread, then walks the REST two at a time -- the final leaf
  // only ends up alone (hard, closed-book style, matching the front cover)
  // when the count of leaves AFTER the front cover is odd. With
  // [blank, ...interior pages, backCover], that count is
  // interiorPageCount + 2 -- odd only when interiorPageCount itself is odd.
  // When interiorPageCount is even, the library instead pairs the back
  // cover with the actual last text page into one ordinary two-page spread
  // -- the last page of the text block and the cover rendering as if
  // they're the same spread, when they're two different things (the text
  // block's own last page belongs only inside that block; the cover only
  // ever appears as the book's own closed-state outside, exactly like the
  // front cover does at the start). One filler blank leaf right before the
  // back cover flips that parity so the back cover always lands alone,
  // regardless of how many text pages there are.
  const needsBackCoverParityFiller = hasCover && hasBackCover && interiorPageCount % 2 === 0;

  const flipLeaves: FlipLeaf[] = useMemo(
    () => [
      ...(hasCover ? [{ kind: "cover" as const, url: coverUrl! }] : []),
      { kind: "blank" as const },
      ...Array.from({ length: interiorPageCount }, (_, i) => ({ kind: "page" as const, pageNumber: i + 1 })),
      ...(needsBackCoverParityFiller ? [{ kind: "blank" as const }] : []),
      ...(hasBackCover ? [{ kind: "backCover" as const, url: backCoverUrl! }] : []),
    ],
    [hasCover, coverUrl, hasBackCover, backCoverUrl, interiorPageCount, needsBackCoverParityFiller]
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
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commitPageInput();
                (e.target as HTMLInputElement).blur();
              }
            }}
            onBlur={commitPageInput}
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
        <Document
          file={printPdfUrl}
          // Was loading={null}/error={null} (no feedback at all) -- fine for
          // a short local file, but this book's own manuscript grew to 368
          // pages / 14MB during today's testing, and fetching+parsing a file
          // that size over the network is genuinely slow. With zero loading
          // UI, that whole window just showed blank white pages with nothing
          // telling the author anything was happening -- indistinguishable
          // from "broken" (author-reported 2026-09-10: cover appeared fast,
          // since it's a separate small <img> below, not part of this
          // <Document>, but the PDF-backed interior stayed blank with no
          // explanation). RENDER_WINDOW's own per-leaf blank placeholders
          // (below) are intentional and unrelated -- this is specifically
          // about the initial fetch/parse of the whole file having no
          // indicator at all.
          loading={
            <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
              Завантаження книжки…
            </div>
          }
          error={
            <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-red-500">
              Не вдалося завантажити PDF. Спробуйте оновити сторінку.
            </div>
          }
        >
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
              if (leaf.kind === "backCover") {
                return (
                  <div key="back-cover" className="h-full w-full bg-white">
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

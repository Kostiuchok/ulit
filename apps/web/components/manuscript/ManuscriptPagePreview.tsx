"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type WheelEvent } from "react";
import { useRouter } from "next/navigation";
import HTMLFlipBook from "react-pageflip-enhanced";
import { ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { ManuscriptProseStyles } from "./manuscriptProseStyles";
import { useManuscriptPagination } from "./useManuscriptPagination";
import { PAGE_W, PAGE_H, MARGIN_X, MARGIN_TOP, MARGIN_BOTTOM, CONTENT_W, CONTENT_H, PRINT_BODY_PX } from "./manuscriptLayout";
import { DEFAULT_PAGE_NUMBER_POSITION, type PageNumberPosition } from "shared-types";
import { cn } from "@/lib/utils";

// A5 trim — fixed at book creation, the only size this preview supports
// today. Scale/margins live in manuscriptLayout.ts (shared with the editor's
// A5 check-toggle, T-1961) and aren't tied to the real print pipeline
// (that's the separate T-1940 PDF job).

const WHEEL_THROTTLE_MS = 550;

interface Props {
  bookId: string;
  coverUrl?: string | null;
  manuscriptContent: any;
  pageNumberPosition?: PageNumberPosition;
}

interface FlipEvent {
  data: number;
}

type FlipLeaf =
  | { kind: "cover"; url: string }
  | { kind: "blank" }
  | { kind: "page"; html: string; blockId: string | null };

export function ManuscriptPagePreview({
  bookId,
  coverUrl,
  manuscriptContent,
  pageNumberPosition = DEFAULT_PAGE_NUMBER_POSITION,
}: Props) {
  const router = useRouter();
  const { pages } = useManuscriptPagination(manuscriptContent, CONTENT_W, CONTENT_H, PRINT_BODY_PX);
  const bookRef = useRef<{ pageFlip: () => any } | null>(null);
  const [current, setCurrent] = useState(0);
  const lastWheel = useRef(0);
  const outerRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // Fit the whole spread (both pages, side by side in usePortrait=false mode
  // -- 2x PAGE_W) inside whatever space is actually available, so flipping a
  // page never also requires scrolling the surrounding page to see the
  // bottom of the book. Scales the rendered box down via CSS transform
  // (crisp at any zoom) rather than shrinking width/height props, which
  // would re-run the whole DOM pagination pass at a different content box.
  useEffect(() => {
    // outerRef/controlsRef don't exist yet while `pages` is still null --
    // the component renders the "Готуємо передперегляд…" early return below
    // instead of this JSX tree at all, so a mount-only effect (empty dep
    // array) would run against a null ref and never fire again once the
    // real layout (and its measurable box) actually appears. Re-run once
    // pagination resolves, and watch the box itself (sidebar collapse,
    // panel resize, etc. don't always fire a window "resize" event).
    if (!outerRef.current) return;

    function recompute() {
      if (!outerRef.current) return;
      const outerStyle = getComputedStyle(outerRef.current);
      const vPadding = parseFloat(outerStyle.paddingTop) + parseFloat(outerStyle.paddingBottom);
      const controlsH = controlsRef.current?.offsetHeight ?? 0;
      const gap = 20; // matches the flex column's gap-5
      const availableH = outerRef.current.clientHeight - vPadding - controlsH - gap;
      const availableW = outerRef.current.clientWidth - 32;
      const spreadW = PAGE_W * 2; // usePortrait=false always renders a two-page spread
      const next = Math.min(availableW / spreadW, availableH / PAGE_H, 1);
      setScale(next > 0 && Number.isFinite(next) ? next : 1);
    }
    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(outerRef.current);
    window.addEventListener("resize", recompute);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, [pages]);

  const hasCover = !!coverUrl;

  // Bookbinding convention: the interior block's page 1 always falls on the
  // RIGHT (recto) side of the first real spread, never the left -- a closed
  // book's front cover is "page 1" on its own, so pages 2+3 are the first
  // true spread, with page 2 (left/verso) blank. This blank leaf achieves
  // that regardless of whether a cover is set: with a cover, leaf 0 (cover)
  // is shown alone and leaf 1 (this blank) becomes the first verso; without
  // one, this blank leaf is itself the first leaf, still pushing the title
  // page onto the first recto. See Figma nodes 14:657/14:841 for the
  // reference spread this reproduces.
  const flipLeaves: FlipLeaf[] = pages
    ? [
        ...(hasCover ? [{ kind: "cover" as const, url: coverUrl! }] : []),
        { kind: "blank" as const },
        ...pages.map((p) => ({ kind: "page" as const, html: p.html, blockId: p.blockId })),
      ]
    : [];
  const totalPages = flipLeaves.length;

  // Printed-page numbering (T-1963) — continuous count across text page
  // leaves only, cover/blank leaves stay unnumbered.
  let pageCounter = 0;
  const pageNumbers = flipLeaves.map((leaf) => (leaf.kind === "page" ? ++pageCounter : null));

  const goPrev = useCallback(() => bookRef.current?.pageFlip()?.flipPrev(), []);
  const goNext = useCallback(() => bookRef.current?.pageFlip()?.flipNext(), []);
  const goTo = useCallback((index: number) => bookRef.current?.pageFlip()?.flip(index), []);

  function handleWheel(e: WheelEvent) {
    const now = Date.now();
    if (now - lastWheel.current < WHEEL_THROTTLE_MS) return;
    if (Math.abs(e.deltaY) < 4) return;
    lastWheel.current = now;
    if (e.deltaY > 0) goNext();
    else goPrev();
  }

  function handleEdit() {
    const leaf = flipLeaves[current];
    const blockId = leaf && leaf.kind === "page" ? leaf.blockId : null;
    router.push(`/dashboard/books/${bookId}/manuscript${blockId ? `?blockId=${blockId}` : ""}`);
  }

  if (!pages) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        Готуємо передперегляд…
      </div>
    );
  }

  return (
    <div ref={outerRef} className="flex h-full flex-col items-center gap-5 overflow-y-auto bg-gray-100 py-8">
      <div ref={controlsRef} className="flex items-center gap-3">
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
            max={totalPages}
            value={current + 1}
            onChange={(e) => goTo(Math.min(Math.max(0, Number(e.target.value) - 1), Math.max(0, totalPages - 1)))}
            className="w-14 rounded border border-gray-300 px-2 py-1 text-center outline-none focus:border-gray-900"
            aria-label="Номер сторінки"
          />
          <span>з {totalPages}</span>
        </div>
        <button
          type="button"
          onClick={goNext}
          disabled={current >= totalPages - 1}
          className="flex h-8 w-8 items-center justify-center rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30"
        >
          <ChevronRight size={16} />
        </button>
        <button
          type="button"
          onClick={handleEdit}
          className="ml-3 flex items-center gap-1.5 rounded bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-700"
        >
          <Pencil size={14} />
          Редагувати
        </button>
      </div>

      <div
        onWheel={handleWheel}
        className="max-w-full shadow-sm"
        style={{ width: PAGE_W * 2 * scale, height: PAGE_H * scale, overflow: "hidden" }}
      >
        {flipLeaves.length > 0 && (
          <div style={{ width: PAGE_W * 2, height: PAGE_H, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          <HTMLFlipBook
            ref={bookRef}
            width={PAGE_W}
            height={PAGE_H}
            size="fixed"
            usePortrait={false}
            showCover={hasCover}
            drawShadow
            maxShadowOpacity={0.3}
            flippingTime={500}
            mobileScrollSupport
            useMouseEvents
            onFlip={(e: FlipEvent) => setCurrent(e.data)}
            className="mx-auto"
          >
            {flipLeaves.map((leaf, i) => {
              if (leaf.kind === "blank") {
                return <div key={`blank-${i}`} className="h-full w-full bg-white" />;
              }
              if (leaf.kind === "cover") {
                return (
                  <div key="cover" className="h-full w-full bg-white">
                    <img src={leaf.url} alt="" className="h-full w-full object-cover" loading="eager" />
                  </div>
                );
              }
              return (
                <div key={i} className="relative h-full w-full overflow-hidden bg-white">
                  <div
                    className="manuscript-prose absolute overflow-hidden"
                    style={{
                      left: MARGIN_X,
                      top: MARGIN_TOP,
                      width: CONTENT_W,
                      height: CONTENT_H,
                      "--ms-font-size": `${PRINT_BODY_PX}px`,
                    } as CSSProperties}
                    dangerouslySetInnerHTML={{ __html: leaf.html }}
                  />
                  {pageNumbers[i] !== null && (
                    <div
                      className={cn(
                        "absolute text-[0.6875rem] text-gray-500",
                        pageNumberPosition === "bottom-left" && "text-left",
                        pageNumberPosition === "bottom-center" && "text-center",
                        pageNumberPosition === "bottom-right" && "text-right"
                      )}
                      style={{ left: MARGIN_X, right: MARGIN_X, bottom: Math.round(MARGIN_BOTTOM / 2.4) }}
                    >
                      {pageNumbers[i]}
                    </div>
                  )}
                </div>
              );
            })}
          </HTMLFlipBook>
          </div>
        )}
      </div>

      <ManuscriptProseStyles />
    </div>
  );
}

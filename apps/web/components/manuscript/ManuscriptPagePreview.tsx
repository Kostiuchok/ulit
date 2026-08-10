"use client";

import { useCallback, useRef, useState, type WheelEvent } from "react";
import { useRouter } from "next/navigation";
import HTMLFlipBook from "react-pageflip-enhanced";
import { ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { ManuscriptProseStyles } from "./manuscriptProseStyles";
import { useManuscriptPagination } from "./useManuscriptPagination";

// A5 trim (148 x 210mm) — fixed at book creation, the only size this preview
// supports today. Scale/margins are on-screen preview constants only, not
// tied to the real print pipeline (that's the separate T-1940 PDF job).
const MM = 3.35;
const PAGE_W = Math.round(148 * MM);
const PAGE_H = Math.round(210 * MM);
const MARGIN_X = Math.round(16 * MM);
const MARGIN_TOP = Math.round(18 * MM);
const MARGIN_BOTTOM = Math.round(20 * MM);
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const CONTENT_H = PAGE_H - MARGIN_TOP - MARGIN_BOTTOM;

const WHEEL_THROTTLE_MS = 550;

interface Props {
  bookId: string;
  coverUrl?: string | null;
  manuscriptContent: any;
}

interface FlipEvent {
  data: number;
}

type FlipLeaf =
  | { kind: "cover"; url: string }
  | { kind: "blank" }
  | { kind: "page"; html: string; blockId: string | null };

export function ManuscriptPagePreview({ bookId, coverUrl, manuscriptContent }: Props) {
  const router = useRouter();
  const { pages } = useManuscriptPagination(manuscriptContent, CONTENT_W, CONTENT_H);
  const bookRef = useRef<{ pageFlip: () => any } | null>(null);
  const [current, setCurrent] = useState(0);
  const lastWheel = useRef(0);

  const hasCover = !!coverUrl;

  const flipLeaves: FlipLeaf[] = pages
    ? [
        ...(hasCover ? [{ kind: "cover" as const, url: coverUrl! }, { kind: "blank" as const }] : []),
        ...pages.map((p) => ({ kind: "page" as const, html: p.html, blockId: p.blockId })),
      ]
    : [];
  const totalPages = flipLeaves.length;

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
    <div className="flex h-full flex-col items-center gap-5 overflow-y-auto bg-gray-100 py-8">
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

      <div onWheel={handleWheel} className="shadow-sm">
        {flipLeaves.length > 0 && (
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
                    style={{ left: MARGIN_X, top: MARGIN_TOP, width: CONTENT_W, height: CONTENT_H }}
                    dangerouslySetInnerHTML={{ __html: leaf.html }}
                  />
                </div>
              );
            })}
          </HTMLFlipBook>
        )}
      </div>

      <ManuscriptProseStyles />
    </div>
  );
}

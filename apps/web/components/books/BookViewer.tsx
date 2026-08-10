"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import HTMLFlipBook from "react-pageflip-enhanced";
import { BackCoverPage } from "./BackCoverPage";
import { Book3DRotator } from "./Book3DRotator";
import { PdfScrollView } from "./PdfScrollView";
import { cn } from "../../lib/utils";

interface PageEntry {
  page: number;
  url: string;
}

interface BackCoverData {
  authorName: string;
  bio?: string | null;
  avatarUrl?: string | null;
}

type Tab = "cover" | "color" | "bw";

type FlipLeaf =
  | { kind: "blank" }
  | { kind: "cover"; url: string }
  | { kind: "page"; page: number; url: string }
  | { kind: "backmatter" };

interface Props {
  coverUrl?: string | null;
  backCoverUrl?: string | null;
  pages: PageEntry[];
  pagesBw?: PageEntry[];
  backCover: BackCoverData;
  pdfUrl?: string | null;
  onClose: () => void;
}

interface FlipEvent {
  data: number;
}

export function BookViewer({ coverUrl, backCoverUrl, pages, pagesBw = [], backCover, onClose }: Props) {
  const [tab, setTab] = useState<Tab>(coverUrl ? "cover" : "color");
  const [viewMode, setViewMode] = useState<"flip" | "pdf">("flip");
  const [current, setCurrent] = useState(0);
  const bookRef = useRef<{ pageFlip: () => any } | null>(null);

  const activePages = tab === "bw" ? pagesBw : pages;

  // Front cover is a real hard leaf (showCover) so opening it is an animated
  // flip, not a tab swap. showCover only marks the first/last leaf as hard —
  // the very next spread still pairs leaves 1+2, so a blank spacer right
  // after the cover keeps page 1 landing on the right (recto), same as when
  // there's no cover at all (blank leaf 0 does that job instead).
  const flipPages: FlipLeaf[] = useMemo(() => {
    if (activePages.length === 0) return [];
    const body: FlipLeaf[] = activePages.map((p) => ({ kind: "page" as const, page: p.page, url: p.url }));
    const lead: FlipLeaf[] = coverUrl ? [{ kind: "cover", url: coverUrl }, { kind: "blank" }] : [{ kind: "blank" }];
    return [...lead, ...body, { kind: "backmatter" }];
  }, [activePages, coverUrl]);
  const pageCount = flipPages.length;

  const changeTab = (t: Tab) => {
    setTab(t);
    setCurrent(0);
    setViewMode("flip");
  };

  const goPrev = useCallback(() => bookRef.current?.pageFlip()?.flipPrev(), []);
  const goNext = useCallback(() => bookRef.current?.pageFlip()?.flipNext(), []);
  const goTo = useCallback((page: number) => bookRef.current?.pageFlip()?.flip(page), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (tab === "cover") return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") goNext();
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") goPrev();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, onClose, tab]);

  return (
    <div className="bg-white rounded-xl border shadow-sm">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <button
          onClick={onClose}
          className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          ← Закрити
        </button>

        <div className="flex items-center gap-1 rounded-full border bg-gray-50 p-0.5 text-xs font-medium">
          {(
            [
              { key: "cover" as const, label: "Обкладинка", disabled: !coverUrl },
              { key: "color" as const, label: "Кольорова книга", disabled: pages.length === 0 },
              { key: "bw" as const, label: "Чорно-біла книга", disabled: pagesBw.length === 0 },
            ]
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => !t.disabled && changeTab(t.key)}
              disabled={t.disabled}
              className={cn(
                "px-3 py-1.5 rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed",
                tab === t.key ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-900"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab !== "cover" && (
          <div className="flex items-center rounded-full border bg-gray-50 p-0.5 text-xs font-medium">
            <button
              onClick={() => setViewMode("flip")}
              className={cn(
                "px-3 py-1.5 rounded-full transition-colors",
                viewMode === "flip" ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-900"
              )}
            >
              Гортання
            </button>
            <button
              onClick={() => setViewMode("pdf")}
              className={cn(
                "px-3 py-1.5 rounded-full transition-colors",
                viewMode === "pdf" ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-900"
              )}
            >
              PDF
            </button>
          </div>
        )}
      </div>

      {/* Cover tab — 3D rotation, opens into the flip view on click */}
      {tab === "cover" && coverUrl ? (
        <Book3DRotator
          coverUrl={coverUrl}
          backCoverUrl={backCoverUrl}
          pageCount={pages.length}
          onOpen={() => {
            setTab("color");
            setViewMode("flip");
            setCurrent(0);
          }}
        />
      ) : tab !== "cover" && viewMode === "pdf" ? (
        <PdfScrollView pages={activePages} />
      ) : (
        <>
          {/* Flipbook area */}
          <div className="relative flex items-center justify-center bg-gray-50 py-10 px-4 min-h-[70vh]">
            {current > 0 && (
              <button
                onClick={goPrev}
                aria-label="Попередня сторінка"
                className="absolute left-2 z-10 text-gray-400 hover:text-gray-900 text-3xl px-3 py-6 rounded hover:bg-gray-100 transition-colors"
              >
                ‹
              </button>
            )}

            {flipPages.length > 0 && (
              <div className="shadow-2xl rounded-sm overflow-hidden">
                <HTMLFlipBook
                  key={tab}
                  ref={bookRef}
                  width={380}
                  height={507}
                  size="stretch"
                  minWidth={240}
                  maxWidth={500}
                  minHeight={320}
                  maxHeight={667}
                  showCover={!!coverUrl}
                  drawShadow
                  maxShadowOpacity={0.3}
                  flippingTime={600}
                  mobileScrollSupport
                  useMouseEvents
                  onFlip={(e: FlipEvent) => setCurrent(e.data)}
                  className="mx-auto"
                >
                  {flipPages.map((leaf, i) => {
                    if (leaf.kind === "blank") {
                      return <div key={`blank-${i}`} className="h-full w-full bg-white" />;
                    }
                    if (leaf.kind === "cover") {
                      return (
                        <div key="cover" className="h-full w-full bg-white">
                          <img src={leaf.url} alt="Обкладинка" className="h-full w-full object-cover" loading="eager" />
                        </div>
                      );
                    }
                    if (leaf.kind === "backmatter") {
                      return (
                        <div key="back-cover" className="h-full w-full">
                          <BackCoverPage
                            authorName={backCover.authorName}
                            bio={backCover.bio}
                            avatarUrl={backCover.avatarUrl}
                          />
                        </div>
                      );
                    }
                    return (
                      <div key={i} className="h-full w-full bg-white">
                        <img
                          src={leaf.url}
                          alt={`Сторінка ${leaf.page}`}
                          className="h-full w-full object-cover"
                          loading="eager"
                        />
                      </div>
                    );
                  })}
                </HTMLFlipBook>
              </div>
            )}

            {current < pageCount - 1 && (
              <button
                onClick={goNext}
                aria-label="Наступна сторінка"
                className="absolute right-2 z-10 text-gray-400 hover:text-gray-900 text-3xl px-3 py-6 rounded hover:bg-gray-100 transition-colors"
              >
                ›
              </button>
            )}
          </div>

          {/* Slider navigator */}
          <div className="flex items-center gap-3 px-6 py-4 border-t">
            <span className="text-xs text-gray-400 w-6 text-right shrink-0">1</span>
            <input
              type="range"
              min={0}
              max={Math.max(0, pageCount - 1)}
              value={current}
              onChange={(e) => goTo(Number(e.target.value))}
              className="flex-1 accent-gray-900"
              aria-label="Навігація по сторінках"
            />
            <span className="text-xs text-gray-400 w-6 shrink-0">{pageCount}</span>
          </div>
        </>
      )}
    </div>
  );
}

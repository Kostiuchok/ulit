"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import HTMLFlipBook from "react-pageflip-enhanced";
import { BackCoverPage } from "./BackCoverPage";
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

export function BookViewer({ coverUrl, backCoverUrl, pages, pagesBw = [], backCover, pdfUrl, onClose }: Props) {
  const [tab, setTab] = useState<Tab>(coverUrl ? "cover" : "color");
  const [is3D, setIs3D] = useState(true);
  const [coverSide, setCoverSide] = useState<0 | 1>(0);
  const [current, setCurrent] = useState(0);
  const bookRef = useRef<{ pageFlip: () => any } | null>(null);

  const activePages = tab === "bw" ? pagesBw : pages;

  // Page 1 conventionally opens recto (right side) — a blank leaf up front
  // reproduces that pairing without relying on the library's own hard-cover
  // mode (which would also change how that leaf flips).
  const flipPages: (PageEntry | null)[] = useMemo(
    () => (activePages.length > 0 ? [null, ...activePages] : []),
    [activePages]
  );
  const pageCount = flipPages.length > 0 ? flipPages.length + 1 : 0; // +1 for the back-cover leaf

  const changeTab = (t: Tab) => {
    setTab(t);
    setCurrent(0);
    setCoverSide(0);
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

  const tilt = is3D ? { transform: "perspective(1400px) rotateY(-10deg)", transformStyle: "preserve-3d" as const } : { transform: "none" };

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

        <div className="flex items-center rounded-full border bg-gray-50 p-0.5 text-xs font-medium">
          <button
            onClick={() => setIs3D(true)}
            className={cn(
              "px-3 py-1.5 rounded-full transition-colors",
              is3D ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-900"
            )}
          >
            3D
          </button>
          {pdfUrl ? (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIs3D(false)}
              className={cn(
                "px-3 py-1.5 rounded-full transition-colors",
                !is3D ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-900"
              )}
            >
              PDF
            </a>
          ) : (
            <span className="px-3 py-1.5 rounded-full text-gray-300 cursor-not-allowed">PDF</span>
          )}
        </div>
      </div>

      {/* Cover tab — single dedicated view */}
      {tab === "cover" && coverUrl ? (
        <>
          <div className="flex items-center justify-center bg-gray-50 py-10 px-4 min-h-[70vh]">
            <div className="h-[70vh] max-h-[720px] shadow-2xl rounded-sm overflow-hidden transition-transform duration-300" style={tilt}>
              <img
                src={coverSide === 0 ? coverUrl : (backCoverUrl ?? coverUrl)}
                alt={coverSide === 0 ? "Передня обкладинка" : "Задня обкладинка"}
                className="h-full aspect-[3/4] object-cover"
              />
            </div>
          </div>

          {backCoverUrl && (
            <div className="flex items-center gap-3 px-6 py-4 border-t">
              <span className="text-xs text-gray-400 w-10 shrink-0">Перед</span>
              <input
                type="range"
                min={0}
                max={1}
                step={1}
                value={coverSide}
                onChange={(e) => setCoverSide(Number(e.target.value) as 0 | 1)}
                className="flex-1 accent-gray-900"
                aria-label="Перед / зад обкладинки"
              />
              <span className="text-xs text-gray-400 w-10 shrink-0 text-right">Зад</span>
            </div>
          )}
        </>
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
              <div className="shadow-2xl rounded-sm overflow-hidden transition-transform duration-300" style={tilt}>
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
                  showCover={false}
                  drawShadow
                  maxShadowOpacity={0.3}
                  flippingTime={600}
                  mobileScrollSupport
                  useMouseEvents
                  onFlip={(e: FlipEvent) => setCurrent(e.data)}
                  className="mx-auto"
                >
                  {flipPages.map((p, i) =>
                    p ? (
                      <div key={i} className="h-full w-full bg-white">
                        <img
                          src={p.url}
                          alt={`Сторінка ${p.page}`}
                          className="h-full w-full object-cover"
                          loading="eager"
                        />
                      </div>
                    ) : (
                      <div key="blank" className="h-full w-full bg-white" />
                    )
                  )}
                  <div key="back-cover" className="h-full w-full">
                    <BackCoverPage
                      authorName={backCover.authorName}
                      bio={backCover.bio}
                      avatarUrl={backCover.avatarUrl}
                    />
                  </div>
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

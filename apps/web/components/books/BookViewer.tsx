"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BackCoverPage } from "./BackCoverPage";
import { cn } from "../../lib/utils";

interface PageEntry {
  type: "cover" | "content" | "back-cover";
  url?: string;
  page?: number;
}

interface BackCoverData {
  authorName: string;
  bio?: string | null;
  avatarUrl?: string | null;
}

interface Props {
  coverUrl?: string | null;
  pages: Array<{ page: number; url: string }>;
  backCover: BackCoverData;
  onClose: () => void;
}

export function BookViewer({ coverUrl, pages, backCover, onClose }: Props) {
  const allPages: PageEntry[] = [
    ...(coverUrl ? [{ type: "cover" as const, url: coverUrl }] : []),
    ...pages.map((p) => ({ type: "content" as const, url: p.url, page: p.page })),
    { type: "back-cover" as const },
  ];

  const [current, setCurrent] = useState(0);
  const thumbnailRef = useRef<HTMLDivElement>(null);

  const go = useCallback(
    (delta: number) => {
      setCurrent((c) => Math.max(0, Math.min(allPages.length - 1, c + delta)));
    },
    [allPages.length]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") go(1);
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") go(-1);
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [go, onClose]);

  // Scroll active thumbnail into view
  useEffect(() => {
    const el = thumbnailRef.current?.querySelector(`[data-idx="${current}"]`);
    el?.scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
  }, [current]);

  const currentPage = allPages[current];

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-black/80 border-b border-white/10 shrink-0">
        <span className="text-white/60 text-sm">
          {current + 1} / {allPages.length}
        </span>
        <button
          onClick={onClose}
          className="text-white/60 hover:text-white text-sm px-3 py-1 rounded hover:bg-white/10 transition-colors"
        >
          ✕ Закрити
        </button>
      </div>

      {/* Main page area */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {/* Prev */}
        {current > 0 && (
          <button
            onClick={() => go(-1)}
            className="absolute left-2 z-10 text-white/50 hover:text-white text-3xl px-3 py-6 rounded hover:bg-white/10 transition-colors"
            aria-label="Попередня сторінка"
          >
            ‹
          </button>
        )}

        {/* Page */}
        <div className="h-full flex items-center justify-center p-4">
          {currentPage.type === "back-cover" ? (
            <div
              className="h-full aspect-[2/3] rounded shadow-2xl overflow-hidden"
              style={{ maxHeight: "calc(100vh - 160px)" }}
            >
              <BackCoverPage
                authorName={backCover.authorName}
                bio={backCover.bio}
                avatarUrl={backCover.avatarUrl}
              />
            </div>
          ) : (
            <img
              key={currentPage.url}
              src={currentPage.url}
              alt={currentPage.type === "cover" ? "Обкладинка" : `Сторінка ${currentPage.page}`}
              className="max-h-full max-w-full object-contain rounded shadow-2xl"
              style={{ maxHeight: "calc(100vh - 160px)" }}
              loading="eager"
            />
          )}
        </div>

        {/* Next */}
        {current < allPages.length - 1 && (
          <button
            onClick={() => go(1)}
            className="absolute right-2 z-10 text-white/50 hover:text-white text-3xl px-3 py-6 rounded hover:bg-white/10 transition-colors"
            aria-label="Наступна сторінка"
          >
            ›
          </button>
        )}
      </div>

      {/* Thumbnail strip */}
      <div
        ref={thumbnailRef}
        className="shrink-0 flex gap-2 overflow-x-auto px-4 py-2 bg-black/80 border-t border-white/10 scrollbar-hide"
        style={{ scrollbarWidth: "none" }}
      >
        {allPages.map((p, i) => (
          <button
            key={i}
            data-idx={i}
            onClick={() => setCurrent(i)}
            className={cn(
              "shrink-0 h-16 rounded overflow-hidden border-2 transition-all",
              i === current ? "border-white opacity-100" : "border-transparent opacity-40 hover:opacity-70"
            )}
          >
            {p.type === "back-cover" ? (
              <div className="h-16 aspect-[2/3] bg-gray-800 flex items-center justify-center text-xs text-white/50">
                ←
              </div>
            ) : (
              <img
                src={p.url}
                alt=""
                className="h-16 aspect-[2/3] object-cover"
                loading="lazy"
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

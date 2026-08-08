"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

type SpreadEntry =
  | { kind: "single"; content: "back-cover" }
  | { kind: "spread"; left: PageEntry | null; right: PageEntry | null };

type Tab = "cover" | "color" | "bw";

interface Props {
  coverUrl?: string | null;
  pages: PageEntry[];
  pagesBw?: PageEntry[];
  backCover: BackCoverData;
  pdfUrl?: string | null;
  onClose: () => void;
}

function buildContentSpreads(pages: PageEntry[]): Array<{ left: PageEntry | null; right: PageEntry | null }> {
  if (pages.length === 0) return [];
  // Page 1 conventionally opens recto (right side), so the first spread
  // pairs it with a blank left — matching how the printed book will look.
  const spreads: Array<{ left: PageEntry | null; right: PageEntry | null }> = [
    { left: null, right: pages[0] },
  ];
  for (let i = 1; i < pages.length; i += 2) {
    spreads.push({ left: pages[i] ?? null, right: pages[i + 1] ?? null });
  }
  return spreads;
}

function PageImage({ page }: { page: PageEntry | null }) {
  if (!page) {
    return <div className="h-full aspect-[3/4] bg-white" />;
  }
  return (
    <img
      src={page.url}
      alt={`Сторінка ${page.page}`}
      className="h-full aspect-[3/4] object-cover bg-white"
      loading="eager"
    />
  );
}

export function BookViewer({ coverUrl, pages, pagesBw = [], backCover, pdfUrl, onClose }: Props) {
  const [tab, setTab] = useState<Tab>(coverUrl ? "cover" : "color");
  const [current, setCurrent] = useState(0);
  const [is3D, setIs3D] = useState(true);

  const activePages = tab === "bw" ? pagesBw : pages;

  const allSpreads: SpreadEntry[] = useMemo(() => {
    const contentSpreads = buildContentSpreads(activePages).map(
      (s): SpreadEntry => ({ kind: "spread", ...s })
    );
    return [...contentSpreads, { kind: "single", content: "back-cover" }];
  }, [activePages]);

  const changeTab = (t: Tab) => {
    setTab(t);
    setCurrent(0);
  };

  const go = useCallback(
    (delta: number) => {
      setCurrent((c) => Math.max(0, Math.min(allSpreads.length - 1, c + delta)));
    },
    [allSpreads.length]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (tab === "cover") return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") go(1);
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") go(-1);
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [go, onClose, tab]);

  const entry = allSpreads[current];
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
        <div className="flex items-center justify-center bg-gray-50 py-10 px-4 min-h-[420px]">
          <div className="h-[360px] shadow-2xl rounded-sm overflow-hidden transition-transform duration-300" style={tilt}>
            <img src={coverUrl} alt="Обкладинка" className="h-full aspect-[3/4] object-cover" />
          </div>
        </div>
      ) : (
        <>
          {/* Spread area */}
          <div className="relative flex items-center justify-center bg-gray-50 py-10 px-4 min-h-[420px]">
            {current > 0 && (
              <button
                onClick={() => go(-1)}
                aria-label="Попередня сторінка"
                className="absolute left-2 z-10 text-gray-400 hover:text-gray-900 text-3xl px-3 py-6 rounded hover:bg-gray-100 transition-colors"
              >
                ‹
              </button>
            )}

            <div className="h-[360px] shadow-2xl rounded-sm overflow-hidden transition-transform duration-300" style={tilt}>
              {entry?.kind === "single" && entry.content === "back-cover" && (
                <div className="h-full aspect-[3/4]">
                  <BackCoverPage
                    authorName={backCover.authorName}
                    bio={backCover.bio}
                    avatarUrl={backCover.avatarUrl}
                  />
                </div>
              )}
              {entry?.kind === "spread" && (
                <div className="h-full flex">
                  <div className="relative">
                    <PageImage page={entry.left} />
                    <div className="absolute inset-y-0 right-0 w-3 bg-gradient-to-l from-black/15 to-transparent" />
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/15 to-transparent" />
                    <PageImage page={entry.right} />
                  </div>
                </div>
              )}
            </div>

            {current < allSpreads.length - 1 && (
              <button
                onClick={() => go(1)}
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
              max={Math.max(0, allSpreads.length - 1)}
              value={current}
              onChange={(e) => setCurrent(Number(e.target.value))}
              className="flex-1 accent-gray-900"
              aria-label="Навігація по сторінках"
            />
            <span className="text-xs text-gray-400 w-6 shrink-0">{allSpreads.length}</span>
          </div>
        </>
      )}
    </div>
  );
}

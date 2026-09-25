"use client";

import { useRef, useState } from "react";
import { resolveBookPrintFormat } from "shared-types";
import { TabletCoverFrame } from "@/components/books/TabletCoverFrame";
import { PrintedCoverFrame } from "@/components/books/PrintedCoverFrame";

interface Props {
  coverUrl?: string | null;
  backCoverUrl?: string | null;
  hasEbook: boolean;
  hasPrint: boolean;
  // Real per-book print trim (same shape resolveBookPrintFormat expects) --
  // drives PrintedCoverFrame's aspect ratio so a pocket-format book and a
  // large-format book each get a correctly-shaped preview instead of one
  // fixed box for every book. Omitted entirely falls back to the old fixed
  // Ridero-matched ratio.
  genre?: string | null;
  printWidthMm?: number | null;
  printHeightMm?: number | null;
  printFormatKey?: string | null;
  // Controlled mode -- lets a parent (e.g. the format picker on the book page)
  // drive which slide is shown. Uncontrolled (internal state) when omitted.
  activeKey?: string;
  onActiveKeyChange?: (key: string) => void;
}

export function BookCoverCarousel({
  coverUrl,
  backCoverUrl,
  hasEbook,
  hasPrint,
  genre,
  printWidthMm,
  printHeightMm,
  printFormatKey,
  activeKey,
  onActiveKeyChange,
}: Props) {
  const format = resolveBookPrintFormat({ genre, printWidthMm, printHeightMm, printFormatKey });
  const trimMm = { widthMm: format.widthMm, heightMm: format.heightMm };

  const slides: { key: string; label: string; node: React.ReactNode }[] = [];

  if (hasEbook) {
    slides.push({ key: "ebook", label: "Електронна", node: <TabletCoverFrame coverUrl={coverUrl} className="h-full" /> });
  }
  // A designed back cover is itself proof of print intent (CoverDesigner's
  // back-cover panel only exists for the print edition) -- an author who's
  // just finished the cover but hasn't set a print price yet (hasPrint,
  // price-driven) would otherwise get an orphaned back-cover slide with no
  // matching front-cover slide beside it, which reads as broken.
  const hasPrintCover = hasPrint || !!backCoverUrl;
  if (hasPrintCover) {
    slides.push({ key: "print-front", label: "Друкована — перед", node: <PrintedCoverFrame coverUrl={coverUrl} trimMm={trimMm} className="h-full" /> });
  }
  if (backCoverUrl) {
    slides.push({ key: "print-back", label: "Задня сторона обкладинки", node: <PrintedCoverFrame coverUrl={backCoverUrl} trimMm={trimMm} mirror className="h-full" /> });
  }
  if (slides.length === 0) {
    slides.push({ key: "ebook", label: "Електронна", node: <TabletCoverFrame coverUrl={coverUrl} className="h-full" /> });
  }

  const [internalActive, setInternalActive] = useState(0);
  const controlledIndex = activeKey != null ? slides.findIndex((s) => s.key === activeKey) : -1;
  const current = controlledIndex >= 0 ? controlledIndex : Math.min(internalActive, slides.length - 1);
  const touchX = useRef<number | null>(null);
  const swiped = useRef(false);

  function selectIndex(i: number) {
    const next = Math.min(Math.max(0, i), slides.length - 1);
    setInternalActive(next);
    onActiveKeyChange?.(slides[next].key);
  }

  return (
    <div className="flex h-full flex-col space-y-3">
      {/* No shared fixed aspect-ratio here: TabletCoverFrame keeps its own
          fixed tablet-shaped ratio (a physical tablet screen has one shape),
          while PrintedCoverFrame now sizes itself from the book's own real
          trimMm -- forcing both into one shared box would either crop/distort
          whichever one doesn't match it, or letterbox awkwardly. Letting the
          wrapper size to the active slide's own intrinsic aspect ratio means
          each renders at its correct shape; height may shift a bit when
          switching between the ebook and print slides, which is correct --
          they really are differently-shaped objects. */}
      <div
        className={`relative flex min-h-0 w-full flex-1 items-center justify-center ${slides.length > 1 ? "cursor-pointer" : ""}`}
        onClick={
          slides.length > 1
            ? () => {
                if (swiped.current) {
                  swiped.current = false;
                  return;
                }
                selectIndex((current + 1) % slides.length);
              }
            : undefined
        }
        onTouchStart={(e) => {
          touchX.current = e.changedTouches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (touchX.current == null || slides.length < 2) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) < 40) return;
          swiped.current = true;
          selectIndex(current + (dx < 0 ? 1 : -1));
        }}
      >
        <div key={slides[current].key} aria-label={slides[current].label} className="h-full w-full">
          {slides[current].node}
        </div>
      </div>

      {slides.length > 1 && (
        <div className="flex items-center justify-center gap-2">
          {slides.map((s, i) => (
            <button
              key={s.key}
              type="button"
              aria-label={s.label}
              aria-current={i === current}
              onClick={() => selectIndex(i)}
              className={`h-2 w-2 rounded-full transition-colors ${
                i === current ? "bg-black" : "bg-gray-300 hover:bg-gray-400"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

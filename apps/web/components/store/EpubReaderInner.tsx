"use client";

import { useState, useCallback, useRef } from "react";
import { ReactReader, ReactReaderStyle } from "react-reader";
import type { Rendition } from "epubjs";

interface Props {
  url: string;
  previewStart: number | null;
  previewEnd: number | null;
  pageCount: number | null;
  bookTitle: string;
  bookPrice?: number | null;
  onBuy?: () => void;
  onClose: () => void;
}

type Theme = "light" | "sepia" | "dark";

const THEMES: { id: Theme; label: string; bg: string; fg: string }[] = [
  { id: "light", label: "Світла", bg: "#ffffff", fg: "#1a1a1a" },
  { id: "sepia", label: "Сепія", bg: "#f5f0e8", fg: "#3d2b1a" },
  { id: "dark", label: "Темна", bg: "#1a1a1a", fg: "#e0e0e0" },
];

// previewEnd as page number → fraction 0-1 to compare against epubjs percentage
function toFraction(previewEnd: number | null, pageCount: number | null): number | null {
  if (previewEnd === null) return null;
  if (pageCount !== null && pageCount > 0) return previewEnd / pageCount;
  // Fallback: treat previewEnd as a percentage (1-100)
  return Math.min(1, previewEnd / 100);
}

export function EpubReaderInner({
  url,
  previewEnd,
  pageCount,
  bookTitle,
  bookPrice,
  onBuy,
  onClose,
}: Props) {
  const [location, setLocation] = useState<string | number>(0);
  const [theme, setTheme] = useState<Theme>("light");
  const [showPaywall, setShowPaywall] = useState(false);
  const renditionRef = useRef<Rendition | null>(null);
  const paywallFraction = toFraction(previewEnd, pageCount);

  const handleLocationChange = useCallback((newLoc: string) => {
    setLocation(newLoc);
  }, []);

  function applyTheme(t: Theme, rend?: Rendition | null) {
    const found = THEMES.find((th) => th.id === t);
    if (!found) return;
    const r = rend ?? renditionRef.current;
    if (!r) return;
    r.themes.override("color", found.fg);
    r.themes.override("background", found.bg);
    r.themes.override("background-color", found.bg);
  }

  function handleGetRendition(rend: Rendition) {
    renditionRef.current = rend;
    applyTheme(theme, rend);

    if (paywallFraction !== null) {
      rend.on("relocated", (loc: { start: { percentage: number; cfi: string } }) => {
        if (loc.start.percentage > paywallFraction) {
          setShowPaywall(true);
          // Snap back to just before the paywall
          const safeLocation = rend.book.locations.cfiFromPercentage(
            Math.max(0, paywallFraction - 0.01)
          );
          rend.display(safeLocation).catch(() => {});
        }
      });
    }
  }

  function handleThemeChange(t: Theme) {
    setTheme(t);
    applyTheme(t);
  }

  const themeConfig = THEMES.find((t) => t.id === theme)!;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: themeConfig.bg, color: themeConfig.fg }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b shrink-0"
        style={{ background: themeConfig.bg, borderColor: theme === "dark" ? "#333" : "#e5e7eb" }}
      >
        <p className="text-sm font-semibold truncate max-w-xs">{bookTitle}</p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => handleThemeChange(t.id)}
                title={t.label}
                className="h-5 w-5 rounded-full border-2 transition-transform hover:scale-110"
                style={{
                  background: t.bg,
                  borderColor: theme === t.id ? "#3b82f6" : "#d1d5db",
                }}
              />
            ))}
          </div>
          {paywallFraction !== null && (
            <span className="text-xs opacity-60">
              Уривок {Math.round(paywallFraction * 100)}%
            </span>
          )}
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1 text-sm hover:opacity-70"
          >
            ✕ Закрити
          </button>
        </div>
      </div>

      {/* Reader */}
      <div className="flex-1 relative overflow-hidden">
        <ReactReader
          url={url}
          location={location}
          locationChanged={handleLocationChange}
          readerStyles={ReactReaderStyle}
          getRendition={handleGetRendition}
        />

        {/* Paywall overlay */}
        {showPaywall && (
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-auto">
            <div className="mx-auto max-w-sm text-center text-white space-y-3 px-4">
              <p className="text-2xl font-bold">Уривок завершено</p>
              <p className="text-sm opacity-80">
                Ви досягли кінця безкоштовного уривку книги «{bookTitle}».
              </p>
              {bookPrice != null && (
                <p className="text-lg font-semibold">
                  Повна версія — {bookPrice.toFixed(2)} грн
                </p>
              )}
              <div className="flex flex-col gap-2">
                {onBuy && (
                  <button
                    onClick={onBuy}
                    className="w-full rounded-lg bg-white py-3 text-sm font-bold text-gray-900 hover:bg-gray-100 transition-colors"
                  >
                    Придбати повну версію →
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="w-full rounded-lg border border-white/40 py-2 text-sm text-white hover:bg-white/10 transition-colors"
                >
                  Закрити
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

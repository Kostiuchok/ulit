"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const EpubReaderInner = dynamic(
  () => import("./EpubReaderInner").then((m) => m.EpubReaderInner),
  { ssr: false }
);

interface PreviewConfig {
  previewUrl: string;
  previewStart: number | null;
  previewEnd: number | null;
  pageCount: number | null;
}

interface Props {
  bookSlug: string;
  bookTitle: string;
  bookId: string;
  bookPrice?: number | null;
}

export function EpubReader({ bookSlug, bookTitle, bookId, bookPrice }: Props) {
  const [config, setConfig] = useState<PreviewConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  async function handleOpen() {
    if (config) {
      setOpen(true);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const res = await fetch(`${apiUrl}/api/store/books/${encodeURIComponent(bookSlug)}/preview`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Уривок недоступний");
        return;
      }
      const data: PreviewConfig = await res.json();
      setConfig(data);
      setOpen(true);
    } catch {
      setError("Помилка завантаження уривку");
    } finally {
      setLoading(false);
    }
  }

  function handleBuy() {
    setOpen(false);
    // Scroll to buy section or trigger BuyButton — dispatch a custom event
    window.dispatchEvent(new CustomEvent("knyha:buy", { detail: { bookId, format: "EBOOK" } }));
  }

  return (
    <>
      <button
        onClick={handleOpen}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
      >
        {loading ? (
          <span className="animate-pulse">Завантаження…</span>
        ) : (
          <>📖 Читати уривок</>
        )}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {open && config && (
        <EpubReaderInner
          url={config.previewUrl}
          previewStart={config.previewStart}
          previewEnd={config.previewEnd}
          pageCount={config.pageCount}
          bookTitle={bookTitle}
          bookPrice={bookPrice}
          onBuy={handleBuy}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

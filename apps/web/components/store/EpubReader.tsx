"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/cartStore";
import { Button } from "@/components/ui/button";

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
  bookAuthor: string;
  coverUrl?: string | null;
}

export function EpubReader({ bookSlug, bookTitle, bookId, bookPrice, bookAuthor, coverUrl }: Props) {
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);
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
      const res = await fetch(`/api/store/books/${encodeURIComponent(bookSlug)}/preview`);
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
    if (bookPrice == null) return;
    addItem({
      bookId,
      format: "EBOOK",
      title: bookTitle,
      author: bookAuthor,
      coverUrl,
      formatLabel: "Електронна книга (EPUB + FB2 + MOBI)",
      price: bookPrice,
    });
    router.push("/cart");
  }

  return (
    <>
      <Button variant="outline" onClick={handleOpen} loading={loading} className="border-gray-300 text-gray-700">
        📖 Читати уривок
      </Button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {open && config &&
        createPortal(
          <EpubReaderInner
            url={config.previewUrl}
            previewStart={config.previewStart}
            previewEnd={config.previewEnd}
            pageCount={config.pageCount}
            bookTitle={bookTitle}
            bookPrice={bookPrice}
            onBuy={handleBuy}
            onClose={() => setOpen(false)}
          />,
          document.body
        )}
    </>
  );
}

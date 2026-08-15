"use client";

import { useState } from "react";
import { TabletCoverFrame } from "@/components/books/TabletCoverFrame";
import { PrintedCoverFrame } from "@/components/books/PrintedCoverFrame";

interface Props {
  coverUrl?: string | null;
  backCoverUrl?: string | null;
  hasEbook: boolean;
  hasPrint: boolean;
}

export function BookCoverCarousel({ coverUrl, backCoverUrl, hasEbook, hasPrint }: Props) {
  const slides: { key: string; label: string; node: React.ReactNode }[] = [];

  if (hasEbook) {
    slides.push({ key: "ebook", label: "Електронна", node: <TabletCoverFrame coverUrl={coverUrl} /> });
  }
  if (hasPrint) {
    slides.push({ key: "print-front", label: "Друкована — перед", node: <PrintedCoverFrame coverUrl={coverUrl} /> });
  }
  if (backCoverUrl) {
    slides.push({ key: "print-back", label: "Задня сторона обкладинки", node: <PrintedCoverFrame coverUrl={backCoverUrl} mirror /> });
  }
  if (slides.length === 0) {
    slides.push({ key: "ebook", label: "Електронна", node: <TabletCoverFrame coverUrl={coverUrl} /> });
  }

  const [active, setActive] = useState(0);
  const current = Math.min(active, slides.length - 1);

  return (
    <div className="space-y-3">
      <div
        className={`relative flex w-full items-center justify-center ${slides.length > 1 ? "cursor-pointer" : ""}`}
        style={{ aspectRatio: "232 / 341" }}
        onClick={slides.length > 1 ? () => setActive((a) => (a + 1) % slides.length) : undefined}
      >
        <div key={slides[current].key} aria-label={slides[current].label} className="w-full">
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
              onClick={() => setActive(i)}
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

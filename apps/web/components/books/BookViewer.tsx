"use client";

import { useState } from "react";
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

type Tab = "color" | "bw" | "3d";

interface Props {
  coverUrl?: string | null;
  backCoverUrl?: string | null;
  spineUrl?: string | null;
  title?: string;
  pages: PageEntry[];
  pagesBw?: PageEntry[];
  backCover: BackCoverData;
  pdfUrl?: string | null;
  onClose: () => void;
}

// Simplified sidebar preview (2026-08-10): flip-animation and the old
// "Обкладинка" tab are hidden for now per Anatolii — just two continuous
// PDF-style scroll views (color/bw, cover first) plus a plain 3D rotate
// button, no mode-switching between them. The flip/showCover machinery and
// Book3DRotator's onOpen-to-flip transition stay available in
// Book3DRotator.tsx for whenever this gets revisited.
export function BookViewer({ coverUrl, backCoverUrl, spineUrl, title, pages, pagesBw = [], onClose }: Props) {
  const [tab, setTab] = useState<Tab>("color");
  const activePages = tab === "bw" ? pagesBw : pages;

  return (
    <div className="bg-white rounded-xl border shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
          ← Закрити
        </button>

        <div className="flex items-center gap-1 rounded-full border bg-gray-50 p-0.5 text-xs font-medium">
          {(
            [
              { key: "color" as const, label: "PDF (Кольоровий)", disabled: pages.length === 0 },
              { key: "bw" as const, label: "PDF (Чорно-білий)", disabled: pagesBw.length === 0 },
              { key: "3d" as const, label: "3D", disabled: !coverUrl },
            ]
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => !t.disabled && setTab(t.key)}
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

        <div className="w-[60px]" />
      </div>

      {tab === "3d" && coverUrl ? (
        <Book3DRotator coverUrl={coverUrl} backCoverUrl={backCoverUrl} spineUrl={spineUrl} title={title} pageCount={pages.length} />
      ) : (
        <PdfScrollView coverUrl={coverUrl} backCoverUrl={backCoverUrl} pages={activePages} />
      )}
    </div>
  );
}

"use client";

import dynamic from "next/dynamic";
import type { CoverFormat } from "./CoverDesignerCanvas";

const CoverDesignerCanvas = dynamic(() => import("./CoverDesignerCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center rounded-lg border bg-gray-50 h-96">
      <p className="text-sm text-gray-400">Завантаження редактора…</p>
    </div>
  ),
});

interface Props {
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  subtitle?: string | null;
  description?: string | null;
  authorBio?: string | null;
  isbn?: string | null;
  pageCount?: number | null;
  trimMm?: { widthMm: number; heightMm: number } | null;
  format: CoverFormat;
  existingCoverUrl?: string | null;
  savedDesign?: { front: any[]; backSpine: any[]; background: { color: string; imageUrl?: string } } | null;
  coverImageLibrary?: { url: string; uploadedAt: string; kind?: "slot" | "background" }[];
  syncFromBookData?: boolean;
  onSaved: (patch: { coverUrl?: string; backCoverUrl?: string; spineUrl?: string }) => void;
  onLibraryChange?: (library: { url: string; uploadedAt: string; kind?: "slot" | "background" }[]) => void;
  token?: string;
}

export function CoverDesigner(props: Props) {
  return <CoverDesignerCanvas {...props} />;
}

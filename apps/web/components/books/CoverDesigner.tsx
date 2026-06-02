"use client";

import dynamic from "next/dynamic";

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
  existingCoverUrl?: string | null;
  onSaved: (url: string) => void;
}

export function CoverDesigner(props: Props) {
  return <CoverDesignerCanvas {...props} />;
}

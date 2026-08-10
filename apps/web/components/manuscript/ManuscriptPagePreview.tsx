"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { StyledParagraph } from "./styledParagraph";
import { ResizableImage } from "./resizableImage";
import { ManuscriptProseStyles } from "./manuscriptProseStyles";

// A5 trim (148 x 210mm) — fixed at book creation, the only size this preview
// supports today. Scale/margins are on-screen preview constants only, not
// tied to the real print pipeline (that's the separate T-1940 PDF job).
const MM = 3.35;
const PAGE_W = Math.round(148 * MM);
const PAGE_H = Math.round(210 * MM);
const MARGIN_X = Math.round(16 * MM);
const MARGIN_TOP = Math.round(18 * MM);
const MARGIN_BOTTOM = Math.round(20 * MM);
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const CONTENT_H = PAGE_H - MARGIN_TOP - MARGIN_BOTTOM;

interface Props {
  bookId: string;
  coverUrl?: string | null;
  manuscriptContent: any;
}

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph", attrs: { style: "normal" } }] };

export function ManuscriptPagePreview({ bookId, coverUrl, manuscriptContent }: Props) {
  const router = useRouter();
  const contentRef = useRef<HTMLDivElement>(null);
  const [bodyPageCount, setBodyPageCount] = useState(1);
  const [page, setPage] = useState(1);

  const hasCover = !!coverUrl;
  const totalPages = (hasCover ? 1 : 0) + bodyPageCount;
  const bodyPageIndex = hasCover ? page - 2 : page - 1;
  const onCoverPage = hasCover && page === 1;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ paragraph: false }),
      TextAlign.configure({ types: ["paragraph"] }),
      StyledParagraph,
      ResizableImage,
    ],
    content: manuscriptContent ?? EMPTY_DOC,
    editable: false,
    immediatelyRender: false,
  });

  // Re-measure whenever the (read-only) content actually lays out — including
  // async image loads reflowing the columns, which ResizeObserver catches.
  useLayoutEffect(() => {
    if (!editor) return;
    const el = contentRef.current;
    if (!el) return;
    const measure = () => setBodyPageCount(Math.max(1, Math.ceil(el.scrollWidth / CONTENT_W)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [editor]);

  function goTo(next: number) {
    setPage(Math.min(Math.max(1, next), Math.max(1, totalPages)));
  }

  function currentBlockId(): string | null {
    const el = contentRef.current;
    if (!el || bodyPageIndex < 0) return null;
    for (const block of Array.from(el.querySelectorAll<HTMLElement>("[data-id]"))) {
      if (Math.floor(block.offsetLeft / CONTENT_W) === bodyPageIndex) return block.getAttribute("data-id");
    }
    return null;
  }

  function handleEdit() {
    const id = currentBlockId();
    router.push(`/dashboard/books/${bookId}/manuscript${id ? `?blockId=${id}` : ""}`);
  }

  if (!editor) return null;

  return (
    <div className="flex h-full flex-col items-center gap-5 overflow-y-auto bg-gray-100 py-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => goTo(page - 1)}
          disabled={page <= 1}
          className="flex h-8 w-8 items-center justify-center rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-1.5 text-sm text-gray-700">
          <input
            type="number"
            min={1}
            max={totalPages}
            value={page}
            onChange={(e) => goTo(Number(e.target.value))}
            className="w-14 rounded border border-gray-300 px-2 py-1 text-center outline-none focus:border-gray-900"
            aria-label="Номер сторінки"
          />
          <span>з {totalPages}</span>
        </div>
        <button
          type="button"
          onClick={() => goTo(page + 1)}
          disabled={page >= totalPages}
          className="flex h-8 w-8 items-center justify-center rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30"
        >
          <ChevronRight size={16} />
        </button>
        <button
          type="button"
          onClick={handleEdit}
          className="ml-3 flex items-center gap-1.5 rounded bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-700"
        >
          <Pencil size={14} />
          Редагувати
        </button>
      </div>

      <div
        className="relative overflow-hidden border border-gray-300 bg-white shadow-sm"
        style={{ width: PAGE_W, height: PAGE_H }}
      >
        {hasCover && (
          <img
            src={coverUrl!}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ opacity: onCoverPage ? 1 : 0, pointerEvents: onCoverPage ? "auto" : "none" }}
          />
        )}
        <div
          className="absolute overflow-hidden"
          style={{
            left: MARGIN_X,
            top: MARGIN_TOP,
            width: CONTENT_W,
            height: CONTENT_H,
            visibility: onCoverPage ? "hidden" : "visible",
          }}
        >
          <div
            ref={contentRef}
            className="manuscript-prose ms-preview-columns"
            style={{
              columnWidth: CONTENT_W,
              columnGap: 0,
              width: CONTENT_W,
              height: CONTENT_H,
              transform: `translateX(-${Math.max(0, bodyPageIndex) * CONTENT_W}px)`,
            }}
          >
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>

      <style jsx>{`
        .ms-preview-columns {
          column-fill: auto;
        }
      `}</style>
      <ManuscriptProseStyles />
    </div>
  );
}

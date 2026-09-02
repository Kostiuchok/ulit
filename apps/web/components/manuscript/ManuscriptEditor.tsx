"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import {
  Save,
  Undo2,
  Redo2,
  Bold,
  Italic,
  UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  IndentIncrease,
  IndentDecrease,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  ImagePlus,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Eye,
  SeparatorHorizontal,
  Eraser,
  Search,
  X,
  BookOpenCheck,
} from "lucide-react";
import { StyledParagraph, STYLE_LABELS, OUTLINE_TIERS, ResizableImage, PageBreak, splitFrontMatter, type StyledBlockStyleName } from "shared-types";
import { ManuscriptProseStyles } from "./manuscriptProseStyles";
import { computePageGeometry, DEFAULT_PAGE_GEOMETRY } from "./manuscriptLayout";
import {
  type PageNumberPosition,
  DEFAULT_PAGE_NUMBER_POSITION,
  PAGE_NUMBER_POSITION_LABELS,
  extractPageNumberPosition,
  withPageNumberPosition,
  stripPageNumberPosition,
} from "shared-types";
import { useLivePageBreaks } from "./useLivePageBreaks";
import { useManuscriptSearch } from "./useManuscriptSearch";
import {
  clearAllFormatting,
  clearSelectionFormatting,
  lowercaseSelection,
  uppercaseSelection,
  mergeSelectionIntoParagraph,
  removeEmptyParagraphsInSelection,
  splitHardBreaksInSelection,
} from "./manuscriptCleanup";
import { useApi } from "@/hooks/useApi";
import { cn } from "@/lib/utils";

interface OutlineItem {
  id: string;
  text: string;
  tier: number;
}

interface StyleOverride {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  align: "left" | "center" | "right" | "justify";
}

interface Props {
  bookId: string;
  initialContent: any;
  initialStyleOverrides?: Record<string, StyleOverride>;
  // Book's real print trim -- drives the toolbar's page-format check
  // (formerly hardcoded to A5 regardless of the book's actual format).
  // Undefined falls back to the platform default trim (DEFAULT_PAGE_GEOMETRY).
  printFormat?: { widthMm: number; heightMm: number; label: string };
}

interface AuthorStyleSet {
  id: string;
  name: string;
  description?: string | null;
  styleOverrides: Record<string, StyleOverride>;
}

interface LayoutTemplate {
  id: string;
  name: string;
  description: string;
  accent: string;
  align: "justify" | "left";
}

const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  {
    id: "business-regular",
    name: "Стандарт книжковий",
    description: "Вирівнювання тексту по лівому краю з абзацами і відступом і заголовки по центру",
    accent: "#f97316",
    align: "justify",
  },
  {
    id: "business-regular-left",
    name: "Стандарт книжковий на всю ширину",
    description: "Вирівнювання тексту по ширині сторінки з абзацами без відступу зліва",
    accent: "#f97316",
    align: "left",
  },
  {
    id: "business-elegance",
    name: "Збірка віршів",
    description: "Форматування адаптоване для віршів з відступами між блоками і заголовками по центру",
    accent: "#22c55e",
    align: "justify",
  },
];

function MiniPagePreview({ accent, align }: { accent: string; align: "justify" | "left" }) {
  const lineWidths = align === "left" ? ["70%", "55%", "60%"] : ["100%", "100%", "80%"];
  return (
    <div className="flex h-8 w-6 shrink-0 flex-col gap-[2px] rounded-[1px] border border-gray-300 bg-white p-[3px]">
      <div className="h-[3px] w-2/3 rounded-[1px]" style={{ backgroundColor: accent }} />
      {lineWidths.map((w, i) => (
        <div key={i} className="h-[2px] rounded-[1px] bg-gray-300" style={{ width: w }} />
      ))}
    </div>
  );
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed",
        active ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
      )}
    >
      {children}
    </button>
  );
}

const MARK_NAMES = ["bold", "italic", "underline", "strike"] as const;

// Applies a captured formatting (marks + alignment) to every paragraph in the
// document carrying the given style — the "update style to match selection"
// behaviour: redefine a style once, every block using it updates immediately.
function applyStyleFormatting(editor: Editor, style: StyledBlockStyleName, fmt: StyleOverride) {
  const { state, view } = editor;
  let tr = state.tr;
  state.doc.descendants((node, pos) => {
    if (node.type.name !== "paragraph" || node.attrs.style !== style) return;
    tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, textAlign: fmt.align });
    const from = pos + 1;
    const to = pos + node.nodeSize - 1;
    if (to <= from) return;
    for (const markName of MARK_NAMES) {
      const markType = state.schema.marks[markName];
      if (!markType) continue;
      if (fmt[markName]) tr = tr.addMark(from, to, markType.create());
      else tr = tr.removeMark(from, to, markType);
    }
  });
  view.dispatch(tr);
}

function extractOutline(editor: Editor): OutlineItem[] {
  const items: OutlineItem[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name !== "paragraph") return;
    const style = node.attrs.style as StyledBlockStyleName;
    const tierIdx = OUTLINE_TIERS.indexOf(style);
    if (tierIdx === -1) return;
    const text = node.textContent.trim();
    if (!text) return;
    items.push({ id: node.attrs.id, text, tier: tierIdx });
  });
  return items;
}

export function ManuscriptEditor({ bookId, initialContent, initialStyleOverrides, printFormat }: Props) {
  const { apiFetch, apiUpload } = useApi();
  const searchParams = useSearchParams();

  const pageGeometry = useMemo(
    () => (printFormat ? computePageGeometry(printFormat.widthMm, printFormat.heightMm) : DEFAULT_PAGE_GEOMETRY),
    [printFormat]
  );

  // Title page + colophon are no longer editable manuscript content (T-1953/
  // T-1962 inserted them once as real prosemirror nodes; now generated fresh
  // from live Book fields at print-render time instead, see
  // shared-types/manuscript/frontMatter.ts + printHtml.ts). Any front matter
  // already baked into a manuscript from before this change is stripped here
  // -- splitFrontMatter is a safe no-op (returns body === content unchanged)
  // when there's nothing to strip, so this covers both old and new books.
  // Computed once at mount: useEditor's `content` option only matters on
  // creation.
  const effectiveInitialContent = useMemo(() => {
    const doc = initialContent ?? { type: "doc", content: [{ type: "paragraph", attrs: { style: "normal" } }] };
    const { body } = splitFrontMatter(doc.content ?? []);
    return { type: "doc", content: body };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [imageError, setImageError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [styleOverrides, setStyleOverrides] = useState<Record<string, StyleOverride>>(
    stripPageNumberPosition(initialStyleOverrides ?? {})
  );
  const [pageNumberPosition, setPageNumberPositionState] = useState<PageNumberPosition>(() =>
    extractPageNumberPosition(initialStyleOverrides)
  );
  const [selectedLayout, setSelectedLayout] = useState<string>(LAYOUT_TEMPLATES[0].id);
  const [authorStyleSets, setAuthorStyleSets] = useState<AuthorStyleSet[]>([]);
  const [showSaveSetForm, setShowSaveSetForm] = useState(false);
  const [newSetName, setNewSetName] = useState("");
  const [newSetDescription, setNewSetDescription] = useState("");
  const [savingSet, setSavingSet] = useState(false);
  const [, forceTick] = useState(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pageCheckMode, setPageCheckMode] = useState(false);
  const [cleanupMenuOpen, setCleanupMenuOpen] = useState(false);
  const cleanupMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch<{ styleSets: AuthorStyleSet[] }>("/api/style-sets")
      .then(({ styleSets }) => setAuthorStyleSets(styleSets))
      .catch(() => {});
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ paragraph: false }),
      TextAlign.configure({ types: ["paragraph"] }),
      StyledParagraph,
      ResizableImage,
      PageBreak,
    ],
    content: effectiveInitialContent,
    onUpdate: ({ editor }) => {
      setOutline(extractOutline(editor));
      scheduleSave(editor.getJSON(), withPageNumberPosition(styleOverrides, pageNumberPosition));
    },
    onSelectionUpdate: () => forceTick((t) => t + 1),
    onTransaction: () => forceTick((t) => t + 1),
    editorProps: {
      handleDrop: (_view, event, _slice, moved) => {
        if (moved) return false;
        const file = event.dataTransfer?.files?.[0];
        if (!file || !file.type.startsWith("image/")) return false;
        event.preventDefault();
        uploadAndInsertImage(file);
        return true;
      },
      handlePaste: (_view, event) => {
        const file = Array.from(event.clipboardData?.items ?? [])
          .find((item) => item.type.startsWith("image/"))
          ?.getAsFile();
        if (!file) return false;
        event.preventDefault();
        uploadAndInsertImage(file);
        return true;
      },
    },
    immediatelyRender: false,
  });

  const livePageBreaks = useLivePageBreaks(editor, pageCheckMode, pageGeometry.contentH);
  const search = useManuscriptSearch(editor);

  useEffect(() => {
    if (!cleanupMenuOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (cleanupMenuRef.current && !cleanupMenuRef.current.contains(e.target as Node)) {
        setCleanupMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [cleanupMenuOpen]);

  async function uploadAndInsertImage(file: File) {
    if (!editor) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setImageError("Підтримуються лише PNG, JPEG, WebP");
      setTimeout(() => setImageError(""), 4000);
      return;
    }
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { url } = await apiUpload<{ url: string }>(`/api/books/${bookId}/manuscript/images`, formData);
      editor.chain().focus().setImage({ src: url }).run();
    } catch (e: any) {
      setImageError(e.message || "Не вдалося завантажити зображення");
      setTimeout(() => setImageError(""), 4000);
    }
  }

  async function performSave(content: any, overrides: Record<string, StyleOverride>) {
    setSaveState("saving");
    try {
      // `overrides` here is expected to already carry the page-number
      // position (via withPageNumberPosition at the call site) -- not
      // re-derived from `pageNumberPosition` state here, since a caller that
      // just changed the position in the same event (setPageNumberPosition)
      // would otherwise race against React's batched state update and save
      // the stale value.
      await apiFetch(`/api/books/${bookId}/manuscript`, {
        method: "PATCH",
        body: JSON.stringify({ content, styleOverrides: overrides }),
      });
      setSaveState("saved");
    } catch (e: any) {
      // The button's own tooltip stays a calm, reassuring message (not this
      // string) -- this is only for diagnosing a real report, same way the
      // "Invalid or missing token" 401s that prompted this whole retry path
      // were originally tracked down via the API's own logs.
      console.error("Manuscript autosave failed:", e.message || e);
      setSaveState("error");
    }
  }

  function scheduleSave(content: any, overrides: Record<string, StyleOverride>) {
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => performSave(content, overrides), 2000);
  }

  function saveStyleOverride(style: StyledBlockStyleName) {
    if (!editor) return;
    const fmt: StyleOverride = {
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      underline: editor.isActive("underline"),
      strike: editor.isActive("strike"),
      align: (editor.getAttributes("paragraph").textAlign as StyleOverride["align"]) || "left",
    };
    applyStyleFormatting(editor, style, fmt);
    const next = { ...styleOverrides, [style]: fmt };
    setStyleOverrides(next);
    scheduleSave(editor.getJSON(), withPageNumberPosition(next, pageNumberPosition));
  }

  function applyStyleToSelection(style: StyledBlockStyleName) {
    if (!editor) return;
    editor.chain().focus().updateAttributes("paragraph", { style }).run();
    const override = styleOverrides[style];
    if (override) applyStyleFormatting(editor, style, override);
  }

  function applyAuthorStyleSet(set: AuthorStyleSet) {
    if (!editor) return;
    const overrides = stripPageNumberPosition(set.styleOverrides);
    for (const [style, fmt] of Object.entries(overrides)) {
      applyStyleFormatting(editor, style as StyledBlockStyleName, fmt);
    }
    const newPosition = extractPageNumberPosition(set.styleOverrides);
    setStyleOverrides(overrides);
    setPageNumberPositionState(newPosition);
    scheduleSave(editor.getJSON(), withPageNumberPosition(overrides, newPosition));
  }

  function setPageNumberPosition(position: PageNumberPosition) {
    if (!editor) return;
    setPageNumberPositionState(position);
    scheduleSave(editor.getJSON(), withPageNumberPosition(styleOverrides, position));
  }

  async function submitSaveStyleSet() {
    if (!newSetName.trim()) return;
    setSavingSet(true);
    try {
      const { styleSet } = await apiFetch<{ styleSet: AuthorStyleSet }>("/api/style-sets", {
        method: "POST",
        body: JSON.stringify({
          name: newSetName.trim(),
          description: newSetDescription.trim() || undefined,
          styleOverrides: withPageNumberPosition(styleOverrides, pageNumberPosition),
        }),
      });
      setAuthorStyleSets((prev) => [styleSet, ...prev]);
      setShowSaveSetForm(false);
      setNewSetName("");
      setNewSetDescription("");
    } catch {
      // keep the form open so the author can retry
    } finally {
      setSavingSet(false);
    }
  }

  function saveNow() {
    if (!editor) return;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    performSave(editor.getJSON(), withPageNumberPosition(styleOverrides, pageNumberPosition));
  }

  useEffect(() => {
    if (editor) setOutline(extractOutline(editor));
  }, [editor]);

  function scrollToBlock(id: string) {
    const el = editor?.view.dom.querySelector<HTMLElement>(`[data-id="${id}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // Deep-link from the paginated preview's "Редагувати" button — jumps to the
  // block currently shown on that preview page via the same data-id lookup
  // the outline sidebar already uses (scrollToBlock above).
  useEffect(() => {
    if (!editor) return;
    const blockId = searchParams.get("blockId");
    if (!blockId) return;
    const timer = setTimeout(() => scrollToBlock(blockId), 100);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, searchParams]);

  const styleOfCurrentBlock: StyledBlockStyleName = editor?.getAttributes("paragraph").style ?? "normal";

  if (!editor) return null;

  return (
    <div className="flex h-full">
      {/* Left — outline */}
      <aside className="w-[260px] shrink-0 overflow-y-auto border-r border-gray-200 bg-[#f3f3f3]">
        <Link
          href={`/dashboard/books/${bookId}`}
          className="flex items-center gap-2 px-8 py-3 text-[0.875rem] font-medium text-black border-b border-gray-300 hover:bg-[#e9e9e9] transition-colors"
        >
          <ChevronLeft size={12} className="shrink-0 text-gray-500" />
          <img src="/figma/icon-text-edit.svg" alt="" className="h-3.5 w-3.5 shrink-0" />
          Рукопис
        </Link>
        <p className="px-8 pt-3 pb-2 text-[0.9375rem] font-bold text-black">Зміст</p>
        <nav className="pb-4">
          {outline.length === 0 && (
            <p className="px-8 text-[0.8125rem] text-gray-400">
              Позначте розділ/главу/заголовок через панель &quot;Стилі тексту&quot; праворуч — вони з&apos;являться тут.
            </p>
          )}
          {outline.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollToBlock(item.id)}
              style={{ paddingLeft: `${32 + item.tier * 14}px` }}
              className="block w-full truncate py-1.5 pr-3 text-left text-[0.9375rem] text-black hover:bg-[#e3e3e3]"
              title={item.text}
            >
              {item.text}
            </button>
          ))}
        </nav>
      </aside>

      {/* Center — toolbar + editor */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-1 border-b border-gray-200 px-3 py-2">
          <ToolbarButton title="Зберегти" onClick={saveNow}>
            <Save size={15} />
          </ToolbarButton>
          <Link
            href={`/dashboard/books/${bookId}/manuscript/preview`}
            className="flex h-7 items-center gap-1.5 rounded px-2 text-[0.8125rem] text-gray-600 hover:bg-gray-100"
            title="Передперегляд"
          >
            <Eye size={15} />
            Передперегляд
          </Link>
          <div className="mx-1 h-5 w-px bg-gray-200" />
          <ToolbarButton title="Скасувати" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
            <Undo2 size={15} />
          </ToolbarButton>
          <ToolbarButton title="Повторити" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
            <Redo2 size={15} />
          </ToolbarButton>
          <div className="mx-1 h-5 w-px bg-gray-200" />
          <ToolbarButton title="Жирний" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
            <Bold size={15} />
          </ToolbarButton>
          <ToolbarButton title="Курсив" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
            <Italic size={15} />
          </ToolbarButton>
          <ToolbarButton title="Підкреслення" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
            <UnderlineIcon size={15} />
          </ToolbarButton>
          <ToolbarButton title="Закреслення" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
            <Strikethrough size={15} />
          </ToolbarButton>
          <div className="mx-1 h-5 w-px bg-gray-200" />
          <ToolbarButton title="Маркований список" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <List size={15} />
          </ToolbarButton>
          <ToolbarButton title="Нумерований список" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            <ListOrdered size={15} />
          </ToolbarButton>
          <ToolbarButton title="Зменшити відступ" onClick={() => editor.chain().focus().liftListItem("listItem").run()}>
            <IndentDecrease size={15} />
          </ToolbarButton>
          <ToolbarButton title="Збільшити відступ" onClick={() => editor.chain().focus().sinkListItem("listItem").run()}>
            <IndentIncrease size={15} />
          </ToolbarButton>
          <div className="mx-1 h-5 w-px bg-gray-200" />
          <ToolbarButton
            title="Вставити розрив сторінки"
            onClick={() => editor.chain().focus().insertContent({ type: "pageBreak" }).run()}
          >
            <SeparatorHorizontal size={15} />
          </ToolbarButton>
          <button
            type="button"
            onClick={() => setPageCheckMode((v) => !v)}
            title={`Змінити розмір канвасу під формат книги (${printFormat ? `${printFormat.widthMm}×${printFormat.heightMm}мм` : "стандартний"}) — перевірити, чи текст/зображення не 'втекли' на межі сторінки`}
            className={cn(
              "flex h-7 items-center gap-1 rounded px-2 text-[0.75rem] font-medium transition-colors",
              pageCheckMode ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
            )}
          >
            <BookOpenCheck size={14} />
            {printFormat ? `${printFormat.widthMm}×${printFormat.heightMm}` : "Формат"}
          </button>
          <ToolbarButton title="Пошук" onClick={() => (search.open ? search.closeSearch() : search.openSearch())} active={search.open}>
            <Search size={15} />
          </ToolbarButton>
          <div className="relative" ref={cleanupMenuRef}>
            <ToolbarButton title="Очистити текст" onClick={() => setCleanupMenuOpen((v) => !v)} active={cleanupMenuOpen}>
              <Eraser size={15} />
            </ToolbarButton>
            {cleanupMenuOpen && (
              <div className="absolute left-0 top-full z-30 mt-1 w-72 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                {[
                  { label: "Скинути всі виділення (весь документ)", run: clearAllFormatting },
                  { label: "Скинути виділення у фрагменті", run: clearSelectionFormatting },
                  { label: "нижній регістр", run: lowercaseSelection },
                  { label: "ВЕРХНІЙ РЕГІСТР", run: uppercaseSelection },
                  { label: "Об'єднати фрагмент в один абзац", run: mergeSelectionIntoParagraph },
                  { label: "Видалити порожні рядки у фрагменті", run: removeEmptyParagraphsInSelection },
                  { label: "Замінити переноси рядків на абзаци", run: splitHardBreaksInSelection },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      item.run(editor);
                      setCleanupMenuOpen(false);
                    }}
                    className="block w-full px-3 py-1.5 text-left text-[0.8125rem] text-gray-700 hover:bg-gray-100"
                  >
                    {item.label}
                  </button>
                ))}
                <div className="my-1 h-px bg-gray-200" />
                <button
                  type="button"
                  onClick={() => {
                    setCleanupMenuOpen(false);
                    search.openSearch();
                  }}
                  className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-[0.8125rem] text-gray-700 hover:bg-gray-100"
                >
                  <Search size={13} />
                  Пошук
                </button>
              </div>
            )}
          </div>
          <div className="mx-1 h-5 w-px bg-gray-200" />
          <ToolbarButton title="По лівому краю" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
            <AlignLeft size={15} />
          </ToolbarButton>
          <ToolbarButton title="По центру" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
            <AlignCenter size={15} />
          </ToolbarButton>
          <ToolbarButton title="По правому краю" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
            <AlignRight size={15} />
          </ToolbarButton>
          <ToolbarButton title="По ширині" active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()}>
            <AlignJustify size={15} />
          </ToolbarButton>
          <div className="mx-1 h-5 w-px bg-gray-200" />
          <ToolbarButton title="Вставити зображення" onClick={() => fileInputRef.current?.click()}>
            <ImagePlus size={15} />
          </ToolbarButton>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadAndInsertImage(file);
              e.target.value = "";
            }}
          />
          {editor.isActive("image") && (
            <>
              <div className="mx-1 h-5 w-px bg-gray-200" />
              <ToolbarButton
                title="Зображення ліворуч — текст обтікає"
                active={editor.getAttributes("image").align === "left"}
                onClick={() => editor.chain().focus().updateAttributes("image", { align: "left" }).run()}
              >
                <AlignHorizontalJustifyStart size={15} />
              </ToolbarButton>
              <ToolbarButton
                title="Зображення по центру"
                active={editor.getAttributes("image").align === "center"}
                onClick={() => editor.chain().focus().updateAttributes("image", { align: "center" }).run()}
              >
                <AlignHorizontalJustifyCenter size={15} />
              </ToolbarButton>
              <ToolbarButton
                title="Зображення праворуч — текст обтікає"
                active={editor.getAttributes("image").align === "right"}
                onClick={() => editor.chain().focus().updateAttributes("image", { align: "right" }).run()}
              >
                <AlignHorizontalJustifyEnd size={15} />
              </ToolbarButton>
            </>
          )}

          <div className="ml-auto flex items-center gap-2 text-[0.75rem]">
            {imageError && <span className="text-red-600">{imageError}</span>}
            {/* Save status now lives IN the button's own label (not a
                separate status span next to it) -- a second element next to
                a crowded toolbar row that pops in/out of existence (empty
                when idle, ~90px of text once saved) shifted the row's total
                content width enough to wrap it onto a second line, which is
                what made the toolbar's height jump. One element, fixed
                min-width, can't do that -- its width never changes at all now. */}
            <button
              type="button"
              onClick={saveNow}
              disabled={saveState === "saving"}
              // Explains + reassures rather than showing the raw server
              // error ("Invalid or missing token" etc.) -- that string is
              // accurate but reads as alarming/cryptic to an author, and by
              // itself doesn't say the one thing that actually matters:
              // nothing typed is lost, it's still right here and will go
              // through once retried (useApi.ts already retries once
              // silently before this state is ever reached).
              title={
                saveState === "error"
                  ? "Не вдалося зберегти автоматично. Текст нікуди не зникає — він і далі тут, натисніть, щоб спробувати ще раз."
                  : undefined
              }
              className={cn(
                "min-w-[6.5rem] rounded px-2.5 py-1 text-center font-medium transition-colors disabled:opacity-50",
                saveState === "error" ? "bg-red-600 text-white hover:bg-red-700" : "bg-gray-900 text-white hover:bg-gray-700"
              )}
            >
              {saveState === "saving" && "Збереження…"}
              {saveState === "saved" && "✓ Збережено"}
              {saveState === "error" && "⚠ Повторити"}
              {saveState === "idle" && "Зберегти"}
            </button>
          </div>
        </div>

        {search.open && (
          <div className="flex items-center gap-2 border-b border-gray-200 bg-[#fafafa] px-3 py-1.5">
            <Search size={14} className="shrink-0 text-gray-400" />
            <input
              autoFocus
              value={search.query}
              onChange={(e) => search.onQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") search.next();
                if (e.key === "Escape") search.closeSearch();
              }}
              placeholder="Пошук у тексті…"
              className="w-64 rounded border border-gray-300 px-2 py-1 text-[0.8125rem] outline-none focus:border-gray-900"
            />
            <span className="text-[0.75rem] text-gray-400">
              {search.query.trim() ? `${search.matches.length > 0 ? search.index + 1 : 0} з ${search.matches.length}` : ""}
            </span>
            <ToolbarButton title="Попередній" onClick={search.prev} disabled={search.matches.length === 0}>
              <ChevronUp size={15} />
            </ToolbarButton>
            <ToolbarButton title="Наступний" onClick={search.next} disabled={search.matches.length === 0}>
              <ChevronDown size={15} />
            </ToolbarButton>
            <ToolbarButton title="Закрити пошук" onClick={search.closeSearch}>
              <X size={15} />
            </ToolbarButton>
          </div>
        )}

        <div className="flex-1 overflow-y-auto bg-white px-16 py-10">
          <div className="relative mx-auto" style={pageCheckMode ? { width: pageGeometry.contentW } : { maxWidth: 680 }}>
            <EditorContent
              editor={editor}
              className="manuscript-prose"
              style={pageCheckMode ? ({ "--ms-font-size": `${pageGeometry.bodyFontPx}px` } as CSSProperties) : undefined}
            />
            {pageCheckMode &&
              livePageBreaks.map((y, i) => (
                <div key={i} className="manuscript-page-break-marker" style={{ top: y }} data-label={`— кінець сторінки ${i + 1} —`} />
              ))}
          </div>
        </div>
      </div>

      {/* Right — paragraph styles */}
      <aside className="w-[240px] shrink-0 overflow-y-auto border-l border-gray-200 bg-[#f3f3f3] p-4">
        <p className="mb-3 text-[0.875rem] font-medium text-black">Стилі тексту</p>
        <div className="space-y-0.5">
          {(Object.keys(STYLE_LABELS) as StyledBlockStyleName[]).map((key) => {
            const isActive = styleOfCurrentBlock === key;
            return (
              <div key={key} className="flex items-center gap-1">
                <button
                  onClick={() => applyStyleToSelection(key)}
                  className={cn(
                    "block flex-1 min-w-0 rounded px-2.5 py-1.5 text-left text-[0.875rem] transition-colors",
                    isActive ? "bg-gray-900 text-white" : "text-black hover:bg-[#e3e3e3]"
                  )}
                >
                  {STYLE_LABELS[key]}
                </button>
                {isActive && (
                  <button
                    onClick={() => saveStyleOverride(key)}
                    title="Зберегти новий стиль — застосувати поточне форматування до всього тексту з цим стилем"
                    className="shrink-0 rounded p-1.5 text-gray-500 hover:bg-[#e3e3e3] hover:text-black"
                  >
                    <Save size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <p className="mb-3 mt-6 text-[0.875rem] font-medium text-black">Номери сторінок</p>
        <div className="flex gap-1">
          {(Object.keys(PAGE_NUMBER_POSITION_LABELS) as PageNumberPosition[]).map((pos) => {
            const Icon = pos === "bottom-left" ? AlignLeft : pos === "bottom-right" ? AlignRight : AlignCenter;
            const isActive = pageNumberPosition === pos;
            return (
              <button
                key={pos}
                type="button"
                onClick={() => setPageNumberPosition(pos)}
                title={PAGE_NUMBER_POSITION_LABELS[pos]}
                className={cn(
                  "flex h-8 flex-1 items-center justify-center rounded border transition-colors",
                  isActive ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-600 hover:border-gray-400"
                )}
              >
                <Icon size={14} />
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-[0.6875rem] leading-snug text-gray-400">
          Розташування номера сторінки в друкованому передперегляді. Зберігається разом із набором стилів.
        </p>

        <p className="mb-3 mt-6 text-[0.875rem] font-medium text-black">Набір стилів</p>
        <div className="space-y-2">
          {LAYOUT_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => setSelectedLayout(tpl.id)}
              className={cn(
                "block w-full rounded-md border bg-white p-2.5 text-left transition-colors",
                selectedLayout === tpl.id ? "border-gray-900 ring-1 ring-gray-900" : "border-gray-200 hover:border-gray-400"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[0.6875rem] font-bold uppercase leading-tight text-black">{tpl.name}</p>
                <span className="shrink-0 rounded-sm bg-gray-100 px-1 py-px text-[0.5625rem] text-gray-500">
                  {printFormat ? `${printFormat.widthMm}×${printFormat.heightMm}` : "Стандарт"}
                </span>
              </div>
              <p className="mt-1 text-[0.6875rem] leading-snug text-gray-500">{tpl.description}</p>
              <div className="mt-2 flex gap-1.5">
                <MiniPagePreview accent={tpl.accent} align={tpl.align} />
                <MiniPagePreview accent={tpl.accent} align={tpl.align} />
                <MiniPagePreview accent={tpl.accent} align={tpl.align} />
              </div>
            </button>
          ))}
        </div>

        <div className="mb-3 mt-6 flex items-center justify-between">
          <p className="text-[0.875rem] font-medium text-black">Мої набори стилів</p>
          <button
            onClick={() => setShowSaveSetForm((v) => !v)}
            title="Зберегти поточне форматування як особистий набір стилів"
            className="rounded p-1 text-gray-500 hover:bg-[#e3e3e3] hover:text-black"
          >
            <Save size={13} />
          </button>
        </div>

        {showSaveSetForm && (
          <div className="mb-2 space-y-2 rounded-md border border-gray-300 bg-white p-2.5">
            <input
              value={newSetName}
              onChange={(e) => setNewSetName(e.target.value)}
              placeholder="Назва набору стилів"
              className="w-full rounded border border-gray-200 px-2 py-1.5 text-[0.8125rem] outline-none focus:border-gray-900"
            />
            <textarea
              value={newSetDescription}
              onChange={(e) => setNewSetDescription(e.target.value)}
              placeholder="Короткий опис (необов'язково)"
              rows={2}
              className="w-full resize-none rounded border border-gray-200 px-2 py-1.5 text-[0.8125rem] outline-none focus:border-gray-900"
            />
            <div className="flex gap-2">
              <button
                onClick={submitSaveStyleSet}
                disabled={!newSetName.trim() || savingSet}
                className="flex-1 rounded bg-gray-900 py-1.5 text-[0.8125rem] text-white disabled:opacity-40"
              >
                {savingSet ? "Збереження…" : "Зберегти"}
              </button>
              <button
                onClick={() => setShowSaveSetForm(false)}
                className="rounded border border-gray-200 px-3 py-1.5 text-[0.8125rem] text-black hover:bg-gray-50"
              >
                Скасувати
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {authorStyleSets.length === 0 && !showSaveSetForm && (
            <p className="text-[0.75rem] text-gray-400">
              Тут з&apos;являться ваші збережені набори стилів — доступні для будь-якої вашої книги.
            </p>
          )}
          {authorStyleSets.map((set) => (
            <button
              key={set.id}
              onClick={() => applyAuthorStyleSet(set)}
              className="block w-full rounded-md border border-gray-200 bg-white p-2.5 text-left transition-colors hover:border-gray-400"
            >
              <p className="text-[0.6875rem] font-bold uppercase leading-tight text-black">{set.name}</p>
              {set.description && <p className="mt-1 text-[0.6875rem] leading-snug text-gray-500">{set.description}</p>}
            </button>
          ))}
        </div>
      </aside>

      <ManuscriptProseStyles />
    </div>
  );
}

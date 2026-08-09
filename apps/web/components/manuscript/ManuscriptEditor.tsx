"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
  ChevronLeft,
  ChevronDown,
} from "lucide-react";
import { StyledParagraph, STYLE_LABELS, OUTLINE_TIERS, type StyledBlockStyleName } from "./styledParagraph";
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

export function ManuscriptEditor({ bookId, initialContent, initialStyleOverrides }: Props) {
  const { apiFetch } = useApi();
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState("");
  const [styleOverrides, setStyleOverrides] = useState<Record<string, StyleOverride>>(initialStyleOverrides ?? {});
  const [selectedLayout, setSelectedLayout] = useState<string>(LAYOUT_TEMPLATES[0].id);
  const [authorStyleSets, setAuthorStyleSets] = useState<AuthorStyleSet[]>([]);
  const [showSaveSetForm, setShowSaveSetForm] = useState(false);
  const [newSetName, setNewSetName] = useState("");
  const [newSetDescription, setNewSetDescription] = useState("");
  const [savingSet, setSavingSet] = useState(false);
  const [, forceTick] = useState(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    ],
    content: initialContent ?? { type: "doc", content: [{ type: "paragraph", attrs: { style: "normal" } }] },
    onUpdate: ({ editor }) => {
      setOutline(extractOutline(editor));
      scheduleSave(editor.getJSON(), styleOverrides);
    },
    onSelectionUpdate: () => forceTick((t) => t + 1),
    onTransaction: () => forceTick((t) => t + 1),
    immediatelyRender: false,
  });

  async function performSave(content: any, overrides: Record<string, StyleOverride>) {
    setSaveState("saving");
    try {
      await apiFetch(`/api/books/${bookId}/manuscript`, {
        method: "PATCH",
        body: JSON.stringify({ content, styleOverrides: overrides }),
      });
      setSaveState("saved");
    } catch (e: any) {
      setSaveError(e.message || "Помилка збереження");
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
    scheduleSave(editor.getJSON(), next);
  }

  function applyStyleToSelection(style: StyledBlockStyleName) {
    if (!editor) return;
    editor.chain().focus().updateAttributes("paragraph", { style }).run();
    const override = styleOverrides[style];
    if (override) applyStyleFormatting(editor, style, override);
  }

  function applyAuthorStyleSet(set: AuthorStyleSet) {
    if (!editor) return;
    for (const [style, fmt] of Object.entries(set.styleOverrides)) {
      applyStyleFormatting(editor, style as StyledBlockStyleName, fmt);
    }
    setStyleOverrides(set.styleOverrides);
    scheduleSave(editor.getJSON(), set.styleOverrides);
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
          styleOverrides,
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
    performSave(editor.getJSON(), styleOverrides);
  }

  useEffect(() => {
    if (editor) setOutline(extractOutline(editor));
  }, [editor]);

  function scrollToBlock(id: string) {
    const el = editor?.view.dom.querySelector<HTMLElement>(`[data-id="${id}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

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
              Позначте розділ/главу/заголовок через панель "Стилі тексту" праворуч — вони з'являться тут.
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

          <div className="ml-auto flex items-center gap-2 text-[0.75rem]">
            <span className={cn(saveState === "error" ? "text-red-600" : "text-gray-400")}>
              {saveState === "saving" && "Збереження…"}
              {saveState === "saved" && "✓ Збережено"}
              {saveState === "error" && `⚠ Не збережено — ${saveError}`}
            </span>
            <button
              type="button"
              onClick={saveNow}
              disabled={saveState === "saving"}
              className={cn(
                "rounded px-2.5 py-1 font-medium transition-colors disabled:opacity-50",
                saveState === "error" ? "bg-red-600 text-white hover:bg-red-700" : "bg-gray-900 text-white hover:bg-gray-700"
              )}
            >
              {saveState === "error" ? "Повторити" : "Зберегти"}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-white px-16 py-10">
          <EditorContent editor={editor} className="manuscript-prose mx-auto max-w-[680px]" />
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
                <span className="shrink-0 rounded-sm bg-gray-100 px-1 py-px text-[0.5625rem] text-gray-500">A5</span>
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
              Тут з'являться ваші збережені набори стилів — доступні для будь-якої вашої книги.
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

      <style jsx global>{`
        .manuscript-prose { outline: none; }
        .manuscript-prose p { margin: 0 0 0.9em; }
        .manuscript-prose p[data-style="chapter"] {
          font-size: 1.5rem; font-weight: 700; text-align: center; text-transform: uppercase;
          letter-spacing: 0.03em; margin-top: 2.5em; margin-bottom: 1em;
        }
        .manuscript-prose p[data-style="section"] {
          font-size: 1.25rem; font-weight: 700; text-align: center; margin-top: 2em; margin-bottom: 1em;
        }
        .manuscript-prose p[data-style="heading"] { font-size: 1.05rem; font-weight: 700; margin-top: 1.2em; }
        .manuscript-prose p[data-style="subheading"] { font-size: 0.95rem; font-weight: 600; color: #444; }
        .manuscript-prose p[data-style="normal"] { text-indent: 1.5em; text-align: justify; }
        .manuscript-prose p[data-style="epigraph"] {
          font-style: italic; text-align: right; margin-left: auto; max-width: 60%; color: #555;
        }
        .manuscript-prose p[data-style="quote"] {
          font-style: italic; border-left: 2px solid #ccc; padding-left: 1em; color: #444;
        }
        .manuscript-prose p[data-style="poem"] { text-align: center; white-space: pre-line; }
        .manuscript-prose p[data-style="signature"] { text-align: right; font-size: 0.9rem; color: #666; }
      `}</style>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  ChevronRight,
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

interface Props {
  bookId: string;
  initialContent: any;
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

export function ManuscriptEditor({ bookId, initialContent }: Props) {
  const { apiFetch } = useApi();
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [, forceTick] = useState(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ paragraph: false }),
      TextAlign.configure({ types: ["paragraph"] }),
      StyledParagraph,
    ],
    content: initialContent ?? { type: "doc", content: [{ type: "paragraph", attrs: { style: "normal" } }] },
    onUpdate: ({ editor }) => {
      setOutline(extractOutline(editor));
      scheduleSave(editor.getJSON());
    },
    onSelectionUpdate: () => forceTick((t) => t + 1),
    onTransaction: () => forceTick((t) => t + 1),
    immediatelyRender: false,
  });

  function scheduleSave(content: any) {
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await apiFetch(`/api/books/${bookId}/manuscript`, {
          method: "PATCH",
          body: JSON.stringify({ content }),
        });
        setSaveState("saved");
      } catch {
        setSaveState("idle");
      }
    }, 2000);
  }

  function saveNow() {
    if (!editor) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    scheduleSave(editor.getJSON());
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
        <div className="flex items-center gap-2 px-4 py-3 text-[14px] font-medium text-black border-b border-gray-300">
          <ChevronRight size={12} className="text-gray-500" />
          Рукопис
        </div>
        <p className="px-4 pt-3 pb-2 text-[15px] font-bold text-black">Зміст</p>
        <nav className="pb-4">
          {outline.length === 0 && (
            <p className="px-4 text-[13px] text-gray-400">
              Позначте розділ/главу/заголовок через панель "Стилі тексту" праворуч — вони з'являться тут.
            </p>
          )}
          {outline.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollToBlock(item.id)}
              style={{ paddingLeft: `${16 + item.tier * 14}px` }}
              className="block w-full truncate py-1.5 pr-3 text-left text-[15px] text-black hover:bg-[#e3e3e3]"
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

          <div className="ml-auto text-[12px] text-gray-400">
            {saveState === "saving" && "Збереження…"}
            {saveState === "saved" && "✓ Збережено"}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-white px-16 py-10">
          <EditorContent editor={editor} className="manuscript-prose mx-auto max-w-[680px]" />
        </div>
      </div>

      {/* Right — paragraph styles */}
      <aside className="w-[240px] shrink-0 overflow-y-auto border-l border-gray-200 bg-[#f3f3f3] p-4">
        <p className="mb-3 text-[14px] font-medium text-black">Стилі тексту</p>
        <div className="space-y-0.5">
          {(Object.keys(STYLE_LABELS) as StyledBlockStyleName[]).map((key) => (
            <button
              key={key}
              onClick={() => editor.chain().focus().updateAttributes("paragraph", { style: key }).run()}
              className={cn(
                "block w-full rounded px-2.5 py-1.5 text-left text-[14px] transition-colors",
                styleOfCurrentBlock === key ? "bg-gray-900 text-white" : "text-black hover:bg-[#e3e3e3]"
              )}
            >
              {STYLE_LABELS[key]}
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

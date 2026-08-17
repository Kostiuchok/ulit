import Paragraph from "@tiptap/extension-paragraph";
import { Plugin } from "@tiptap/pm/state";

// Structurally-typed stand-in for the DOM's HTMLElement -- these parseHTML()
// callbacks are only invoked by TipTap when parsing FROM html (never during
// generateHTML()'s json->html direction, which is the only thing the worker's
// print-PDF render calls, T-2057). Avoids requiring the "dom" lib in every
// consumer's tsconfig (apps/api, apps/worker are Node-only, no DOM lib).
interface AttrElement {
  getAttribute(name: string): string | null;
}

export type StyledBlockStyleName =
  | "chapter"
  | "section"
  | "heading"
  | "subheading"
  | "normal"
  | "epigraph"
  | "quote"
  | "poem"
  | "signature";

export const STYLE_LABELS: Record<StyledBlockStyleName, string> = {
  chapter: "Розділ",
  section: "Глава",
  heading: "Заголовок",
  subheading: "Підзаголовок",
  normal: "Звичайний",
  epigraph: "Епіграф",
  quote: "Цитата",
  poem: "Вірші",
  signature: "Дата/Підпис",
};

// Tiers that count as document structure for the "Зміст" outline panel, most→least significant.
export const OUTLINE_TIERS: StyledBlockStyleName[] = ["chapter", "section", "heading", "subheading"];

let idCounter = 0;
function generateBlockId() {
  idCounter += 1;
  return `sb-${Date.now().toString(36)}-${idCounter}`;
}

/**
 * Extends TipTap's built-in Paragraph node (keeps the name "paragraph") rather than
 * introducing a new node type — internal fallbacks (Enter-key default block, empty-doc
 * default, ListItem content) hardcode the "paragraph" name, so renaming would break them.
 * Registered after StarterKit in the editor's extension list; TipTap dedupes extensions by
 * name and the later one wins, so this definition replaces StarterKit's plain Paragraph.
 */
export const StyledParagraph = Paragraph.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: {
        default: "normal" as StyledBlockStyleName,
        parseHTML: (el: AttrElement) => (el.getAttribute("data-style") as StyledBlockStyleName) || "normal",
        renderHTML: (attrs: { style: StyledBlockStyleName }) => ({ "data-style": attrs.style }),
      },
      id: {
        default: null,
        parseHTML: (el: AttrElement) => el.getAttribute("data-id"),
        renderHTML: (attrs: { id: string | null }) => ({ "data-id": attrs.id }),
      },
      // Presentational-only override, independent of `style` -- used by the
      // generated front-matter (T-1962) for title-page/colophon-specific
      // treatments (imprint line, bold catalog code, footer) that have no
      // business being pickable in the "Стилі тексту" panel alongside the
      // author's real structural styles.
      variant: {
        default: null as string | null,
        parseHTML: (el: AttrElement) => el.getAttribute("data-variant"),
        renderHTML: (attrs: { variant: string | null }) =>
          attrs.variant ? { "data-variant": attrs.variant } : {},
      },
    };
  },

  addProseMirrorPlugins() {
    const typeName = this.name;
    const parentPlugins = this.parent?.() ?? [];
    return [
      ...parentPlugins,
      new Plugin({
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          const seen = new Set<string>();
          let tr = newState.tr;
          let changed = false;
          newState.doc.descendants((node, pos) => {
            if (node.type.name !== typeName) return;
            const id = node.attrs.id as string | null;
            if (!id || seen.has(id)) {
              tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, id: generateBlockId() });
              changed = true;
            } else {
              seen.add(id);
            }
          });
          return changed ? tr : null;
        },
      }),
    ];
  },
});

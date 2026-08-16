import { Node, mergeAttributes } from "@tiptap/core";

/**
 * One "Зміст" (table of contents) line — text on the left, page number on
 * the right. Purely presentational and never persisted: built fresh on
 * every pagination pass by paginateManuscriptWithToc() from the manuscript's
 * own outline (Розділ/Глава/Заголовок/Підзаголовок), never part of the
 * author-edited manuscriptContent. Registered in MANUSCRIPT_EXTENSIONS
 * alongside PageBreak purely so generateHTML() can render it.
 */
export const TocEntry = Node.create({
  name: "tocEntry",
  group: "block",
  atom: true,
  selectable: false,
  draggable: false,

  addAttributes() {
    return {
      text: { default: "", rendered: false },
      page: { default: null, rendered: false },
      tier: { default: 0, rendered: false },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="toc-entry"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const { text, page, tier } = node.attrs as { text: string; page: number | null; tier: number };
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "toc-entry", "data-tier": String(tier) }),
      ["span", { class: "toc-entry-text" }, text],
      ["span", { class: "toc-entry-page" }, page != null ? String(page) : ""],
    ];
  },
});

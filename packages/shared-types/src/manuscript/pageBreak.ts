import { Node, mergeAttributes } from "@tiptap/core";

/**
 * A manual, author-inserted page break — Word's "Insert Page Break". Atomic
 * block node (no content, not enterable), rendered as a dashed marker line
 * in the live editor (see manuscriptProseStyles.tsx). The manuscript-preview
 * pagination algorithm (paginateManuscript.ts) recognizes this node via
 * data-type="page-break" and treats it as a forced page boundary — it
 * contributes no visible content of its own to any page. The server-side
 * print render (printHtml.ts) maps the same data-type to a hard CSS
 * `break-before: page`.
 */
export const PageBreak = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  parseHTML() {
    return [{ tag: 'div[data-type="page-break"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "page-break", contenteditable: "false" })];
  },
});

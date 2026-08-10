import Image from "@tiptap/extension-image";

export type ImageAlign = "left" | "center" | "right";

/**
 * Extends TipTap's official Image node (same pattern as StyledParagraph) with an
 * `align` attribute for left/center/right positioning. Resize handles are the
 * built-in @tiptap/extension-image node view (resize.enabled) — no third-party
 * resize package needed.
 */
export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: "center" as ImageAlign,
        parseHTML: (el: HTMLElement) => (el.getAttribute("data-align") as ImageAlign) || "center",
        renderHTML: (attrs: { align: ImageAlign }) => ({ "data-align": attrs.align }),
      },
    };
  },
}).configure({
  resize: {
    enabled: true,
    directions: ["top", "bottom", "left", "right", "top-left", "top-right", "bottom-left", "bottom-right"],
    minWidth: 40,
    minHeight: 40,
    alwaysPreserveAspectRatio: true,
  },
});

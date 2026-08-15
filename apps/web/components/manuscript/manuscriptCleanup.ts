import type { Editor } from "@tiptap/react";

// T-1959 "Очистити текст" — finishing touches for a manuscript that's
// already been through real editorial work in Word; these exist to undo
// mechanical docx-import artifacts (stray formatting, soft line breaks,
// leftover blank lines), not to "improve" the author's prose.

/** (1) Clear all marks + alignment across the whole document. */
export function clearAllFormatting(editor: Editor) {
  editor.chain().focus().selectAll().unsetAllMarks().unsetTextAlign().run();
}

/** (2) Clear all marks + alignment within the current selection only. */
export function clearSelectionFormatting(editor: Editor) {
  if (editor.state.selection.empty) return;
  editor.chain().focus().unsetAllMarks().unsetTextAlign().run();
}

function transformSelectionText(editor: Editor, fn: (s: string) => string) {
  const { from, to } = editor.state.selection;
  if (from === to) return;
  const text = editor.state.doc.textBetween(from, to, "\n");
  editor.chain().focus().insertContentAt({ from, to }, fn(text)).run();
}

/** (3) Lowercase the selected text. */
export function lowercaseSelection(editor: Editor) {
  transformSelectionText(editor, (s) => s.toLowerCase());
}

/** (4) Uppercase the selected text. */
export function uppercaseSelection(editor: Editor) {
  transformSelectionText(editor, (s) => s.toUpperCase());
}

/** (5) Merge every paragraph touched by the selection into a single paragraph. */
export function mergeSelectionIntoParagraph(editor: Editor) {
  const { state, view } = editor;
  const { from, to } = state.selection;
  if (from === to) return;

  let rangeStart: number | null = null;
  let rangeEnd: number | null = null;
  let style: string | undefined;
  const texts: string[] = [];

  state.doc.forEach((node, offset) => {
    if (node.type.name !== "paragraph") return;
    const nodeStart = offset;
    const nodeEnd = offset + node.nodeSize;
    if (nodeEnd <= from || nodeStart >= to) return;
    if (rangeStart === null) rangeStart = nodeStart;
    rangeEnd = nodeEnd;
    if (style === undefined) style = node.attrs.style;
    const text = node.textContent.trim();
    if (text) texts.push(text);
  });

  if (rangeStart === null || rangeEnd === null || texts.length === 0) return;
  const paragraphType = state.schema.nodes.paragraph;
  const newParagraph = paragraphType.create({ style: style ?? "normal" }, state.schema.text(texts.join(" ")));
  view.dispatch(state.tr.replaceWith(rangeStart, rangeEnd, newParagraph));
}

/** (6) Delete every empty paragraph touched by the selection. */
export function removeEmptyParagraphsInSelection(editor: Editor) {
  const { state, view } = editor;
  const { from, to } = state.selection;
  if (from === to) return;

  const targets: Array<{ start: number; end: number }> = [];
  state.doc.forEach((node, offset) => {
    if (node.type.name !== "paragraph") return;
    const nodeStart = offset;
    const nodeEnd = offset + node.nodeSize;
    if (nodeEnd <= from || nodeStart >= to) return;
    if (node.textContent.trim() === "") targets.push({ start: nodeStart, end: nodeEnd });
  });
  if (targets.length === 0) return;

  let tr = state.tr;
  for (let i = targets.length - 1; i >= 0; i--) tr = tr.delete(targets[i].start, targets[i].end);
  view.dispatch(tr);
}

/**
 * (7) Split every paragraph touched by the selection at each soft line break
 * (Shift+Enter / hardBreak) into real paragraph breaks -- a common docx/OCR
 * import artifact where what should be separate paragraphs arrives as one
 * paragraph full of manual line breaks.
 */
export function splitHardBreaksInSelection(editor: Editor) {
  const { state, view } = editor;
  const { from, to } = state.selection;
  if (from === to) return;
  const paragraphType = state.schema.nodes.paragraph;
  if (!state.schema.nodes.hardBreak) return;

  const targets: Array<{ start: number; end: number; node: any }> = [];
  state.doc.forEach((node, offset) => {
    if (node.type.name !== "paragraph") return;
    const nodeStart = offset;
    const nodeEnd = offset + node.nodeSize;
    if (nodeEnd <= from || nodeStart >= to) return;
    let hasBreak = false;
    node.forEach((child: any) => {
      if (child.type.name === "hardBreak") hasBreak = true;
    });
    if (hasBreak) targets.push({ start: nodeStart, end: nodeEnd, node });
  });
  if (targets.length === 0) return;

  let tr = state.tr;
  for (let i = targets.length - 1; i >= 0; i--) {
    const { start, end, node } = targets[i];
    const segments: any[][] = [[]];
    node.forEach((child: any) => {
      if (child.type.name === "hardBreak") segments.push([]);
      else segments[segments.length - 1].push(child);
    });
    const newParagraphs = segments
      .filter((seg) => seg.length > 0)
      .map((seg) => paragraphType.create({ style: node.attrs.style }, seg));
    if (newParagraphs.length === 0) continue;
    tr = tr.replaceWith(start, end, newParagraphs);
  }
  view.dispatch(tr);
}

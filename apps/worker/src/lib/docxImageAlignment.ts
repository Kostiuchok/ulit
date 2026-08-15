import { execSync } from "child_process";

export type ImageAlign = "left" | "center" | "right";

// A .docx is a zip container; the wrap side Word actually used for each
// floating image lives in word/document.xml, but Pandoc's docx->JSON AST
// drops it entirely (an Image inline carries only [Attr, altText, [src,
// title]] -- see pandocToEditorDoc.ts). Reading it back means going around
// Pandoc and parsing the raw XML ourselves.
//
// Shells out to `unzip -p` to pull just that one member out of the archive
// -- consistent with the rest of this pipeline (pandoc/libreoffice/
// ghostscript are all invoked the same way) instead of adding a zip-parsing
// npm dependency for a single file read. Requires `unzip` in the worker
// image (apps/worker/Dockerfile).
function readDocumentXml(docxPath: string): string | null {
  try {
    return execSync(`unzip -p "${docxPath}" word/document.xml`, {
      timeout: 15_000,
      maxBuffer: 50 * 1024 * 1024,
    }).toString("utf-8");
  } catch {
    return null; // malformed/password-protected docx, or "unzip" missing -- caller falls back to the default alignment
  }
}

const DRAWING_RE = /<w:drawing\b[^>]*>[\s\S]*?<\/w:drawing>/g;
const WRAP_TEXT_RE = /wrapText="(bothSides|left|right|largest)"/;
const ALIGN_RE = /<wp:align>(left|right|center|inside|outside)<\/wp:align>/;

// DRAWING_RE matches any <w:drawing> element, not just pictures -- Word also
// uses the same element for shapes, text boxes, charts, and SmartArt. A
// leftover empty shape (no embedded picture, no media relationship) counts
// as a drawing but never becomes a Pandoc Image inline, so treating it as an
// image here would throw off the ordinal count against Pandoc's own AST.
// <pic:pic> is the DrawingML picture-part element -- present in every real
// embedded picture, absent from non-picture drawings -- and is the same
// signal Pandoc's own docx reader keys off of to decide whether to emit an
// Image inline at all.
function isPictureDrawing(drawingXml: string): boolean {
  return drawingXml.includes("<pic:pic");
}

function alignOfDrawing(drawingXml: string): ImageAlign {
  if (!drawingXml.includes("<wp:anchor")) return "center"; // <wp:inline> -- not floated, no side to detect

  // <wp:positionH><wp:align>left|right|center|inside|outside</wp:align></wp:positionH>
  // is the most direct signal Word itself writes -- prefer it over the wrap
  // type when both are present.
  const alignMatch = drawingXml.match(ALIGN_RE);
  if (alignMatch) {
    if (alignMatch[1] === "left") return "left";
    if (alignMatch[1] === "right") return "right";
    return "center"; // "center" / "inside" / "outside" -- inside/outside need page-side context we don't have, treat as center
  }

  // Fall back to the wrap element's wrapText side (wrapSquare/wrapTight/
  // wrapThrough all use the same attribute name).
  const wrapMatch = drawingXml.match(WRAP_TEXT_RE);
  if (wrapMatch) {
    if (wrapMatch[1] === "left") return "left";
    if (wrapMatch[1] === "right") return "right";
  }

  return "center"; // wrapTopAndBottom / wrapNone / no signal found
}

/**
 * Real Word wrap-side per embedded image, in document order. Ordinal, not
 * ID-based: the Nth picture-bearing <w:drawing> found here is assumed to
 * correspond to the Nth Image inline Pandoc produced (non-picture drawings
 * -- shapes, text-box frames, charts -- are filtered out by
 * isPictureDrawing() above precisely so they don't throw this off). The
 * caller (import-manuscript.ts / pandocToEditorDoc.ts) only trusts this
 * list if its length exactly matches Pandoc's own image count -- a
 * remaining mismatch (a legacy <w:pict> VML image, or a picture nested
 * inside a text box's <w:txbxContent>, which this regex-based extraction
 * doesn't attempt to unwrap) would otherwise silently misalign every image
 * after the gap, which is worse than the uniform "center" default. Not
 * observed in real manuscripts tested against so far -- accepted as a
 * residual limitation rather than solved with a full XML parser.
 */
export function extractImageAlignments(docxPath: string): ImageAlign[] {
  const xml = readDocumentXml(docxPath);
  if (!xml) return [];

  const alignments: ImageAlign[] = [];
  let match: RegExpExecArray | null;
  DRAWING_RE.lastIndex = 0;
  while ((match = DRAWING_RE.exec(xml)) !== null) {
    if (!isPictureDrawing(match[0])) continue;
    alignments.push(alignOfDrawing(match[0]));
  }
  return alignments;
}

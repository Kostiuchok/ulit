import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { JSDOM } from "jsdom";
import { buildManuscriptPrintHtml, type PageNumberPosition } from "shared-types";

// TipTap's generateHTML() (called inside buildManuscriptPrintHtml, via
// ProseMirror's DOMSerializer) needs a real DOM `document` to build nodes
// before serializing them to a string -- confirmed empirically, it throws
// "window is not defined" in plain Node otherwise. There's no way to inject
// one as an option; it reads the bare global. jsdom provides a headless one,
// set once for the life of this worker process.
if (typeof (globalThis as any).document === "undefined") {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  (globalThis as any).window = dom.window;
  (globalThis as any).document = dom.window.document;
}

export interface RenderManuscriptPdfInput {
  content: any;
  widthMm: number;
  heightMm: number;
  pageNumberPosition?: PageNumberPosition;
  backCoverUrl?: string | null;
  tmpDir: string;
  outputPdfPath: string;
}

// T-2057 -- renders Book.manuscriptContent straight to a print-ready PDF via
// WeasyPrint (CSS Paged Media: @page, break-before/after: recto/verso -- see
// docs/T-2057-checklist.md section 3 for why WeasyPrint over Puppeteer).
// The SAME HTML/CSS this produces is what a live "Завантажити PDF" QA link
// would show byte-for-byte -- no separate preview-only approximation.
export function renderManuscriptPdf({
  content,
  widthMm,
  heightMm,
  pageNumberPosition,
  backCoverUrl,
  tmpDir,
  outputPdfPath,
}: RenderManuscriptPdfInput): void {
  const html = buildManuscriptPrintHtml({ content, widthMm, heightMm, pageNumberPosition, backCoverUrl });
  const htmlPath = path.join(tmpDir, "manuscript.html");
  fs.writeFileSync(htmlPath, html, "utf-8");

  // Array-form execFileSync, not a shell string -- avoids the exact
  // shell-injection class of bug documented in CLAUDE.md journal #10, even
  // though the risky content here (author-supplied title/text) is already
  // isolated inside the HTML file rather than passed as a CLI argument.
  execFileSync("weasyprint", [htmlPath, outputPdfPath], { timeout: 180_000, stdio: "pipe" });
}

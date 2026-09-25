import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import zlib from "zlib";
import { describe, expect, it } from "vitest";
import { buildManuscriptPrintHtml, PRINT_FORMATS, type FrontMatterMeta } from "shared-types";
import { renderManuscriptPdf } from "../src/lib/renderManuscriptPdf";

// ~/.local/bin is where a user-level `pip install --user weasyprint` lands.
// CI installs weasyprint onto the default PATH; this only helps local runs.
const localBin = path.join(os.homedir(), ".local", "bin");
if (fs.existsSync(path.join(localBin, "weasyprint")) && !process.env.PATH?.split(path.delimiter).includes(localBin)) {
  process.env.PATH = `${localBin}${path.delimiter}${process.env.PATH ?? ""}`;
}

const TRIM = PRINT_FORMATS.standard; // 130 × 200 mm
const MM_TO_PT = 72 / 25.4;

function paragraph(text: string, style = "normal", id?: string) {
  return {
    type: "paragraph",
    attrs: { style, id: id ?? null, variant: null },
    content: [{ type: "text", text }],
  };
}

function image(align: "left" | "right" | "center") {
  // 8×8 PNG, enough for WeasyPrint to embed an XObject.
  // 1×1 PNG. WeasyPrint only needs a decodable image to keep the float.
  const png =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  return {
    type: "image",
    attrs: { src: `data:image/png;base64,${png}`, alt: `fig-${align}`, title: null, align },
  };
}

function meta(title: string, subtitle?: string): FrontMatterMeta {
  return {
    title,
    subtitle: subtitle ?? null,
    authorPenName: "E2E Автор",
    authorNameDisplay: "Автор Тестовий",
    authorNameCatalog: "Тестовий Автор",
    description: "Коротка анотація для golden PDF.",
    ageRating: "0+",
    isbn: "978-000-000-000-0",
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

const SHORT_BODY = [
  paragraph("Перший абзац короткого рукопису для перевірки кількості сторінок."),
  paragraph("Другий абзац. Текст має з'явитись у друкованому PDF."),
];

const LONG_TITLE =
  "Дуже довга назва книги яка переноситься на кілька рядків титульної сторінки і не повинна виштовхнути вихідні дані на наступну сторінку";

const LONG_CHAPTER =
  "Розділ із надзвичайно довгим заголовком який у змісті має перенестись на наступний рядок а номер сторінки лишитись у межах аркуша";

function doc(content: unknown[]) {
  return { type: "doc", content };
}

function htmlFor(content: unknown[], title: string, subtitle?: string) {
  return buildManuscriptPrintHtml({
    content: doc(content),
    widthMm: TRIM.widthMm,
    heightMm: TRIM.heightMm,
    frontMatterMeta: meta(title, subtitle),
  });
}

function commandExists(cmd: string): boolean {
  try {
    execFileSync(cmd, ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const hasWeasy = commandExists("weasyprint");
if (process.env.REQUIRE_WEASYPRINT === "1" && !hasWeasy) {
  throw new Error("REQUIRE_WEASYPRINT=1 but the weasyprint binary is not on PATH");
}

function render(content: unknown[], title: string, subtitle?: string): Buffer {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "golden-pdf-"));
  const output = path.join(tmp, "book.pdf");
  renderManuscriptPdf({
    content: doc(content),
    widthMm: TRIM.widthMm,
    heightMm: TRIM.heightMm,
    frontMatterMeta: meta(title, subtitle),
    tmpDir: tmp,
    outputPdfPath: output,
  });
  return fs.readFileSync(output);
}

function inflatePdf(buf: Buffer): string {
  const raw = buf.toString("latin1");
  let extra = "";
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw))) {
    const data = Buffer.from(match[1], "latin1");
    for (const slice of [data, data.subarray(0, Math.max(0, data.length - 1))]) {
      try {
        extra += zlib.inflateSync(slice).toString("latin1");
        break;
      } catch {
        // not a flate stream
      }
    }
  }
  return raw + extra;
}

function pageCount(buf: Buffer): number {
  const text = inflatePdf(buf);
  const pages = text.match(/\/Type\s*\/Page(?!s)/g);
  return pages?.length ?? 0;
}

function mediaBoxes(buf: Buffer): Array<{ w: number; h: number }> {
  const text = inflatePdf(buf);
  const boxes: Array<{ w: number; h: number }> = [];
  const re = /\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    boxes.push({ w: Number(match[3]) - Number(match[1]), h: Number(match[4]) - Number(match[2]) });
  }
  return boxes;
}

function pdfToText(buf: Buffer): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "golden-txt-"));
  const pdfPath = path.join(tmp, "book.pdf");
  fs.writeFileSync(pdfPath, buf);
  try {
    return execFileSync("pdftotext", ["-layout", pdfPath, "-"], { encoding: "utf8" });
  } catch {
    return "";
  }
}

function expectTrim(buf: Buffer) {
  const boxes = mediaBoxes(buf);
  expect(boxes.length).toBeGreaterThan(0);
  const expectedW = TRIM.widthMm * MM_TO_PT;
  const expectedH = TRIM.heightMm * MM_TO_PT;
  for (const box of boxes) {
    expect(Math.abs(box.w - expectedW)).toBeLessThan(2);
    expect(Math.abs(box.h - expectedH)).toBeLessThan(2);
  }
}

describe("print HTML golden (no WeasyPrint required)", () => {
  it("emits the book trim, keeps floats, and does not ellipsize a long TOC heading", () => {
    const html = htmlFor(
      [
        paragraph(LONG_CHAPTER, "chapter", "ch-long"),
        image("left"),
        paragraph("Текст обтікає зображення ліворуч."),
        image("right"),
        paragraph("Текст обтікає зображення праворуч."),
      ],
      LONG_TITLE,
      "Підзаголовок який теж може бути довгим і має сидіти одразу під назвою"
    );

    expect(html).toContain(`size: ${TRIM.widthMm}mm ${TRIM.heightMm}mm`);
    expect(html).toContain(LONG_TITLE);
    expect(html).toContain(LONG_CHAPTER);
    expect(html).toContain('data-align="left"');
    expect(html).toContain('data-align="right"');
    expect(html).toContain("float: left");
    expect(html).toContain("float: right");
    expect(html).not.toMatch(/data-align="left"[^}]*float:\s*none/);
    expect(html).not.toMatch(/data-align="right"[^}]*float:\s*none/);
    expect(html).toContain("min-width: 0");
    expect(html).toContain('class="toc-entry-text"');
  });

  it("puts a short title on the title page without dropping the body", () => {
    const html = htmlFor(SHORT_BODY, "Короткий заголовок");
    expect(html).toContain("Короткий заголовок");
    expect(html).toContain("Перший абзац короткого рукопису");
    expect(html).toContain("E2E Автор");
  });
});

const pdfIt = hasWeasy ? it : it.skip;

describe("golden print PDF (WeasyPrint)", () => {
  pdfIt("short manuscript: page count, trim size, and visible text", () => {
    const buf = render(SHORT_BODY, "Короткий заголовок");
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    const pages = pageCount(buf);
    // Title page + colophon + body. Recorded against WeasyPrint 70.
    // Tolerance of 1 page (docs/testing-roadmap.md phase 5).
    expect(pages).toBeGreaterThanOrEqual(3);
    expect(pages).toBeLessThanOrEqual(6);
    expectTrim(buf);
    const text = pdfToText(buf);
    expect(text).toContain("Короткий заголовок");
    expect(text).toContain("Перший абзац");
    expect(text).toContain("E2E Автор");
  });

  pdfIt("a wrapping title does not add a pile of extra pages versus the short book", () => {
    const shortPages = pageCount(render(SHORT_BODY, "Короткий заголовок"));
    const longPages = pageCount(
      render(SHORT_BODY, LONG_TITLE, "Підзаголовок який теж може бути довгим")
    );
    expect(Math.abs(longPages - shortPages)).toBeLessThanOrEqual(1);
    const text = pdfToText(render(SHORT_BODY, LONG_TITLE, "Підзаголовок який теж може бути довгим"));
    expect(text).toContain("Дуже довга назва");
    expect(text).toContain("Підзаголовок");
  });

  pdfIt("floated images render inside the trim and the surrounding words survive", () => {
    const content = [
      paragraph(LONG_CHAPTER, "chapter", "ch-long"),
      image("left"),
      paragraph("Текст обтікає зображення ліворуч і не зникає."),
      image("right"),
      paragraph("Текст обтікає зображення праворуч і не зникає."),
      paragraph("Завершальний абзац після ілюстрацій."),
    ];
    const buf = render(content, "Книга з ілюстраціями");
    const pages = pageCount(buf);
    expect(pages).toBeGreaterThanOrEqual(3);
    expect(pages).toBeLessThanOrEqual(8);
    expectTrim(buf);
    const text = pdfToText(buf);
    expect(text).toContain("обтікає зображення ліворуч");
    expect(text).toContain("обтікає зображення праворуч");
    expect(text).toContain("Завершальний абзац");
    // The long TOC heading is present in full, not replaced by an ellipsis.
    expect(text).toContain("надзвичайно довгим заголовком");
    expect(text).not.toContain("…");
  });
});

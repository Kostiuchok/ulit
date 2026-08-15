import { Job } from "bullmq";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { downloadToFile, uploadFromFile, publicUrl } from "../lib/minio";
import { prisma } from "../lib/prisma";
import { pandocToEditorDoc } from "../lib/pandocToEditorDoc";
import { extractImageAlignments } from "../lib/docxImageAlignment";

// Formats every browser renders natively via <img> -- uploaded as-is.
const DIRECT_IMAGE_CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
};

// Not browser-renderable -- rasterized to PNG before upload (see below).
const TIFF_EXTENSIONS = new Set([".tiff", ".tif"]);
const VECTOR_EXTENSIONS = new Set([".emf", ".wmf"]); // Word SmartArt/clipart

// Pandoc's docx reader anchors every embedded image at its own Image inline
// in the AST, but --extract-media is what actually writes the image bytes
// to disk (without it, the JSON just references paths that were never
// materialized). Uploads each extracted file to the same
// public/manuscripts/{bookId}/ prefix the manual "insert image" toolbar
// button uses (apps/api/.../manuscript-image.ts), and returns a map from
// pandoc's own relative target path (e.g. "media/image1.png") to the
// resulting public URL, so pandocToEditorDoc can resolve Image inlines to
// real <img src> values instead of dropping them.
async function extractAndUploadMedia(mediaDir: string, bookId: string): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  const mediaSubdir = path.join(mediaDir, "media");
  if (!fs.existsSync(mediaSubdir)) return map;

  const files = fs.readdirSync(mediaSubdir);

  // EMF/WMF can't be rendered as <img> in any browser -- rasterize them to
  // PNG via the same LibreOffice headless binary the docx->PDF pipeline
  // already depends on (convert-docx-to-pdf.ts). Batched into one
  // invocation: soffice's own startup cost, not the per-file conversion,
  // dominates its runtime.
  const vectorFiles = files.filter((f) => VECTOR_EXTENSIONS.has(path.extname(f).toLowerCase()));
  if (vectorFiles.length > 0) {
    try {
      const args = vectorFiles.map((f) => `"${path.join(mediaSubdir, f)}"`).join(" ");
      execSync(`soffice --headless --convert-to png --outdir "${mediaSubdir}" ${args}`, {
        timeout: 120_000,
        stdio: "pipe",
      });
    } catch (err: any) {
      // Best-effort: a failed batch conversion means these files fall
      // through to "still unsupported" below and are dropped individually,
      // not that the whole import fails.
      console.error(`[worker] EMF/WMF rasterization failed for book ${bookId}:`, err.message);
    }
  }

  for (const filename of files) {
    const ext = path.extname(filename).toLowerCase();
    let uploadPath = path.join(mediaSubdir, filename);
    let contentType = DIRECT_IMAGE_CONTENT_TYPES[ext];

    if (!contentType && TIFF_EXTENSIONS.has(ext)) {
      try {
        const pngPath = path.join(mediaSubdir, `${path.parse(filename).name}.converted.png`);
        await sharp(uploadPath).png().toFile(pngPath);
        uploadPath = pngPath;
        contentType = "image/png";
      } catch (err: any) {
        console.error(`[worker] TIFF conversion failed for ${filename} (book ${bookId}):`, err.message);
        continue;
      }
    } else if (!contentType && VECTOR_EXTENSIONS.has(ext)) {
      const convertedPath = path.join(mediaSubdir, `${path.parse(filename).name}.png`);
      if (!fs.existsSync(convertedPath)) continue; // rasterization above failed or skipped this file
      uploadPath = convertedPath;
      contentType = "image/png";
    }

    if (!contentType) continue; // still-unsupported format -- drop rather than upload a broken image

    const objectName = `public/manuscripts/${bookId}/${randomUUID()}${path.extname(uploadPath).toLowerCase()}`;
    await uploadFromFile(objectName, uploadPath, contentType);
    map[`media/${filename}`] = publicUrl(objectName);
  }
  return map;
}

export interface ManuscriptImportData {
  bookId: string;
  format: "MANUSCRIPT_IMPORT";
  docxObjectName: string;
}

export async function importManuscript(job: Job<ManuscriptImportData>) {
  const { bookId, docxObjectName } = job.data;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `book-${bookId}-manuscript-`));

  try {
    const docxPath = path.join(tmpDir, "original.docx");
    await downloadToFile(docxObjectName, docxPath);

    const mediaDir = path.join(tmpDir, "extracted");
    const jsonOutput = execSync(`pandoc "${docxPath}" -t json --extract-media="${mediaDir}"`, {
      timeout: 60_000,
      maxBuffer: 50 * 1024 * 1024,
    }).toString("utf-8");

    const mediaMap = await extractAndUploadMedia(mediaDir, bookId);
    const imageAlignments = extractImageAlignments(docxPath);
    const pandocDoc = JSON.parse(jsonOutput);
    const editorDoc = pandocToEditorDoc(pandocDoc, mediaMap, imageAlignments);

    await prisma.book.update({
      where: { id: bookId },
      data: {
        manuscriptContent: editorDoc as any,
        manuscriptImportedAt: new Date(),
      },
    });

    console.log(`[worker] MANUSCRIPT_IMPORT for ${bookId}: imported`);
  } catch (err: any) {
    console.error(`[worker] MANUSCRIPT_IMPORT failed for ${bookId}:`, err.message);
    throw err;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

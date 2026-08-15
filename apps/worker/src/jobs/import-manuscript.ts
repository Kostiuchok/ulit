import { Job } from "bullmq";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import { downloadToFile, uploadFromFile, publicUrl } from "../lib/minio";
import { prisma } from "../lib/prisma";
import { pandocToEditorDoc } from "../lib/pandocToEditorDoc";

// Browser-renderable raster formats only. Word can also embed EMF/WMF
// (vector clipart/SmartArt) and TIFF -- pandoc happily extracts those too,
// but no mainstream browser renders an <img> pointed at one, so uploading
// them would just produce a broken-image icon instead of no image at all;
// skipped in extractAndUploadMedia below.
const IMAGE_CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
};

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

  for (const filename of fs.readdirSync(mediaSubdir)) {
    const ext = path.extname(filename).toLowerCase();
    const contentType = IMAGE_CONTENT_TYPES[ext];
    if (!contentType) continue; // unsupported/vector format pandoc couldn't convert -- skip rather than upload garbage

    const filePath = path.join(mediaSubdir, filename);
    const objectName = `public/manuscripts/${bookId}/${randomUUID()}${ext}`;
    await uploadFromFile(objectName, filePath, contentType);
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
    const pandocDoc = JSON.parse(jsonOutput);
    const editorDoc = pandocToEditorDoc(pandocDoc, mediaMap);

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

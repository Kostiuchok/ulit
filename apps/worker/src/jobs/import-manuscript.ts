import { Job } from "bullmq";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { downloadToFile } from "../lib/minio";
import { prisma } from "../lib/prisma";
import { pandocToEditorDoc } from "../lib/pandocToEditorDoc";

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

    const jsonOutput = execSync(`pandoc "${docxPath}" -t json`, {
      timeout: 60_000,
      maxBuffer: 50 * 1024 * 1024,
    }).toString("utf-8");

    const pandocDoc = JSON.parse(jsonOutput);
    const editorDoc = pandocToEditorDoc(pandocDoc);

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

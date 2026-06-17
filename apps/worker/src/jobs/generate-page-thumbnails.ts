import { Job } from "bullmq";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { downloadToFile, uploadFromFile } from "../lib/minio";
import { prisma } from "../lib/prisma";

export interface PageThumbnailsData {
  bookId: string;
  format: "PAGE_THUMBNAILS";
  pdfObjectName: string;
}

export async function generatePageThumbnails(job: Job<PageThumbnailsData>) {
  const { bookId, pdfObjectName } = job.data;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `book-${bookId}-pages-`));

  try {
    const pdfPath = path.join(tmpDir, "book.pdf");
    await downloadToFile(pdfObjectName, pdfPath);

    const outputPattern = path.join(tmpDir, "page-%03d.png");
    execSync(
      `gs -dNOPAUSE -dBATCH -sDEVICE=png16m -r96 ` +
      `-sOutputFile="${outputPattern}" "${pdfPath}"`,
      { timeout: 300_000, stdio: "pipe" }
    );

    const files = fs.readdirSync(tmpDir)
      .filter((f) => f.startsWith("page-") && f.endsWith(".png"))
      .sort();

    for (const file of files) {
      const objectName = `public/pages/${bookId}/${file}`;
      await uploadFromFile(objectName, path.join(tmpDir, file), "image/png");
    }

    await prisma.book.update({
      where: { id: bookId },
      data: {
        pageCount: files.length,
        pagesGeneratedAt: new Date(),
      },
    });

    console.log(`[worker] PAGE_THUMBNAILS for ${bookId}: ${files.length} pages generated`);
  } catch (err: any) {
    console.error(`[worker] PAGE_THUMBNAILS failed for ${bookId}:`, err.message);
    throw err;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

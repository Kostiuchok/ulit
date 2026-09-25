import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "./helpers/test-app";

// Journal #12: Queue.add() with a jobId that already exists in Redis returns
// the old job and never runs a new one. These routes must remove a finished
// job before enqueueing the same deterministic id again.

const auth = vi.hoisted(() => ({ userId: "author-1" }));
const bookFindUnique = vi.hoisted(() => vi.fn());
const getJob = vi.hoisted(() => vi.fn());
const add = vi.hoisted(() => vi.fn());
const getSignedUrl = vi.hoisted(() => vi.fn(async (name: string) => `https://ulit.render.ua/storage/${name}`));

vi.mock("../lib/jwt.middleware", () => ({
  authenticate: async (request: { user: { id: string; sub: string; email: string; role: string } }) => {
    request.user = { id: auth.userId, sub: auth.userId, email: "e2e@render.ua", role: "AUTHOR" };
  },
}));

vi.mock("../lib/prisma", () => ({
  prisma: { book: { findUnique: bookFindUnique } },
}));

vi.mock("../lib/queue", () => ({
  bookQueue: { getJob, add },
}));

vi.mock("../services/storage.service", () => ({
  getSignedUrl,
}));

import { bookManuscriptRoutes } from "../modules/books/manuscript";
import { printPreviewRoutes } from "../modules/books/print-preview";

function finishedJob(state: string, progress = 0) {
  return {
    progress,
    getState: async () => state,
    remove: vi.fn(async () => undefined),
  };
}

describe("BullMQ deterministic jobId dedup", () => {
  beforeEach(() => {
    bookFindUnique.mockReset();
    getJob.mockReset();
    add.mockReset();
    getSignedUrl.mockClear();
    add.mockResolvedValue({ progress: 0 });
  });

  async function getManuscript() {
    const app = createTestApp();
    await bookManuscriptRoutes(app);
    const res = await app.inject({ method: "GET", url: "/api/books/book-1/manuscript" });
    await app.close();
    return res;
  }

  async function getPreview(query = "") {
    const app = createTestApp();
    await printPreviewRoutes(app);
    const res = await app.inject({ method: "GET", url: `/api/books/book-1/print-preview${query}` });
    await app.close();
    return res;
  }

  describe("manuscript import (jobId manuscript-<id>)", () => {
    beforeEach(() => {
      bookFindUnique.mockResolvedValue({
        authorId: "author-1",
        originalDocxUrl: "private/book-1.docx",
        manuscriptImportedAt: null,
        manuscriptContent: null,
        manuscriptStyleOverrides: null,
      });
    });

    it("enqueues a fresh import when no job exists", async () => {
      getJob.mockResolvedValue(undefined);
      const res = await getManuscript();
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ status: "PROCESSING", progress: 0 });
      expect(add).toHaveBeenCalledWith(
        "MANUSCRIPT_IMPORT",
        expect.objectContaining({ bookId: "book-1", format: "MANUSCRIPT_IMPORT" }),
        expect.objectContaining({ jobId: "manuscript-book-1" })
      );
    });

    it("removes a completed job before add(), otherwise BullMQ would swallow the re-import", async () => {
      const existing = finishedJob("completed");
      getJob.mockResolvedValue(existing);
      await getManuscript();
      expect(existing.remove).toHaveBeenCalledOnce();
      expect(add).toHaveBeenCalledOnce();
      expect(add.mock.invocationCallOrder[0]).toBeGreaterThan(existing.remove.mock.invocationCallOrder[0]);
    });

    it("removes a failed job the same way", async () => {
      const existing = finishedJob("failed");
      getJob.mockResolvedValue(existing);
      await getManuscript();
      expect(existing.remove).toHaveBeenCalledOnce();
      expect(add).toHaveBeenCalledOnce();
    });

    it("does not remove an in-flight job (add reuses that id instead of duplicating work)", async () => {
      const existing = finishedJob("active", 40);
      getJob.mockResolvedValue(existing);
      const res = await getManuscript();
      expect(existing.remove).not.toHaveBeenCalled();
      expect(add).toHaveBeenCalledWith(
        "MANUSCRIPT_IMPORT",
        expect.anything(),
        expect.objectContaining({ jobId: "manuscript-book-1" })
      );
      expect(res.json().status).toBe("PROCESSING");
    });
  });

  describe("print preview (jobId print-pdf-<id>)", () => {
    const staleBook = {
      authorId: "author-1",
      manuscriptContent: { type: "doc", content: [] },
      manuscriptEditedAt: new Date("2026-09-02T00:00:00.000Z"),
      manuscriptImportedAt: new Date("2026-09-01T00:00:00.000Z"),
      printPdfUrl: "private/book-1-print.pdf",
      printPdfGeneratedAt: new Date("2026-08-01T00:00:00.000Z"),
      printPageCount: 12,
      printMetaUpdatedAt: null,
    };

    beforeEach(() => {
      bookFindUnique.mockResolvedValue(staleBook);
    });

    it("removes a completed render before queueing the same jobId again", async () => {
      const existing = finishedJob("completed");
      getJob.mockResolvedValue(existing);
      const res = await getPreview();
      expect(res.json()).toEqual({ status: "PROCESSING", progress: 0 });
      expect(existing.remove).toHaveBeenCalledOnce();
      expect(add).toHaveBeenCalledWith(
        "PRINT_PDF",
        { bookId: "book-1", format: "PRINT_PDF" },
        expect.objectContaining({ jobId: "print-pdf-book-1" })
      );
    });

    it("returns the in-flight job's progress and does not enqueue a second one", async () => {
      const existing = finishedJob("active", 55);
      getJob.mockResolvedValue(existing);
      const res = await getPreview();
      expect(res.json()).toEqual({ status: "PROCESSING", progress: 55 });
      expect(existing.remove).not.toHaveBeenCalled();
      expect(add).not.toHaveBeenCalled();
    });

    it("leaves a waiting job alone unless force=1, which drops it so a fresh render can start", async () => {
      const waiting = finishedJob("waiting", 0);
      getJob.mockResolvedValue(waiting);
      const held = await getPreview();
      expect(held.json()).toEqual({ status: "PROCESSING", progress: 0 });
      expect(waiting.remove).not.toHaveBeenCalled();
      expect(add).not.toHaveBeenCalled();

      const forced = await getPreview("?force=1");
      expect(waiting.remove).toHaveBeenCalledOnce();
      expect(forced.json()).toEqual({ status: "PROCESSING", progress: 0 });
      expect(add).toHaveBeenCalledOnce();
    });

    it("does not touch the queue when the stored PDF is still fresh", async () => {
      bookFindUnique.mockResolvedValue({
        ...staleBook,
        printPdfGeneratedAt: new Date("2026-09-03T00:00:00.000Z"),
      });
      const res = await getPreview();
      expect(res.json()).toEqual({
        status: "DONE",
        printPdfUrl: "https://ulit.render.ua/storage/private/book-1-print.pdf",
        printPageCount: 12,
      });
      expect(getJob).not.toHaveBeenCalled();
      expect(add).not.toHaveBeenCalled();
    });
  });
});

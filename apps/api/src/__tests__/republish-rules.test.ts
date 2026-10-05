import { describe, it, expect } from "vitest";
import {
  getPendingChangeBlocks,
  hasPendingChanges,
  coverLockedUntil,
  isbnStillValidForEdition,
  buildIsbnEditionSnapshot,
  type IsbnEditionSnapshot,
} from "shared-types";

describe("getPendingChangeBlocks / hasPendingChanges (Phase 3 generalized N blocks)", () => {
  it("empty book has no pending blocks", () => {
    expect(getPendingChangeBlocks({})).toEqual([]);
    expect(hasPendingChanges({})).toBe(false);
  });

  it("staged title/description/genre all collapse into one Вихідні дані block", () => {
    expect(getPendingChangeBlocks({ pendingTitle: "New title" })).toEqual(["Вихідні дані"]);
    expect(getPendingChangeBlocks({ pendingDescription: "New desc" })).toEqual(["Вихідні дані"]);
    expect(getPendingChangeBlocks({ pendingGenre: "Поезія" })).toEqual(["Вихідні дані"]);
    expect(
      getPendingChangeBlocks({ pendingTitle: "T", pendingDescription: "D", pendingGenre: "G" })
    ).toEqual(["Вихідні дані"]);
  });

  it("docxUpdatedAt after publishedAt is a pending Рукопис block", () => {
    expect(
      getPendingChangeBlocks({ docxUpdatedAt: "2026-10-05T00:00:00Z", publishedAt: "2026-10-01T00:00:00Z" })
    ).toEqual(["Рукопис"]);
  });

  it("docxUpdatedAt before/equal publishedAt is NOT pending", () => {
    expect(
      getPendingChangeBlocks({ docxUpdatedAt: "2026-10-01T00:00:00Z", publishedAt: "2026-10-05T00:00:00Z" })
    ).toEqual([]);
  });

  it("docxUpdatedAt with no publishedAt at all (never published) counts as pending", () => {
    expect(getPendingChangeBlocks({ docxUpdatedAt: "2026-10-05T00:00:00Z", publishedAt: null })).toEqual(["Рукопис"]);
  });

  it("pendingCoverUrl is its own Обкладинка block", () => {
    expect(getPendingChangeBlocks({ pendingCoverUrl: "https://example/pending.png" })).toEqual(["Обкладинка"]);
  });

  it("all three at once, in canonical order", () => {
    const blocks = getPendingChangeBlocks({
      pendingTitle: "T",
      docxUpdatedAt: "2026-10-05T00:00:00Z",
      publishedAt: "2026-10-01T00:00:00Z",
      pendingCoverUrl: "https://example/pending.png",
    });
    expect(blocks).toEqual(["Вихідні дані", "Рукопис", "Обкладинка"]);
    expect(hasPendingChanges({ pendingCoverUrl: "x" })).toBe(true);
  });
});

describe("coverLockedUntil (WF-SPEC 90-day cover re-change lock)", () => {
  it("no coverApprovedAt at all -- no lock", () => {
    expect(coverLockedUntil(null)).toBeNull();
    expect(coverLockedUntil(undefined)).toBeNull();
  });

  it("approved 10 days ago -- still locked, ~80 days left", () => {
    const now = new Date("2026-10-05T00:00:00Z");
    const approvedAt = new Date("2026-09-25T00:00:00Z");
    const until = coverLockedUntil(approvedAt, now);
    expect(until).not.toBeNull();
    expect(until!.toISOString()).toBe("2026-12-24T00:00:00.000Z"); // +90 days
  });

  it("approved exactly 90 days ago -- lock has just expired", () => {
    const now = new Date("2026-10-05T00:00:00Z");
    const approvedAt = new Date("2026-07-07T00:00:00Z"); // 90 days before `now`
    expect(coverLockedUntil(approvedAt, now)).toBeNull();
  });

  it("approved 200 days ago -- lock long expired", () => {
    const now = new Date("2026-10-05T00:00:00Z");
    const approvedAt = new Date("2026-03-19T00:00:00Z");
    expect(coverLockedUntil(approvedAt, now)).toBeNull();
  });
});

describe("isbnStillValidForEdition (WF-SPEC ISBN-правило)", () => {
  const base: IsbnEditionSnapshot = buildIsbnEditionSnapshot({
    printFormatKey: "standard",
    printWidthMm: 130,
    printHeightMm: 200,
    title: "Моя книга",
    primaryAuthor: "Тестовий Тест",
    pageCount: 200,
  });

  it("identical edition -- stays valid", () => {
    expect(isbnStillValidForEdition(base, base)).toBe(true);
  });

  it("page count +5% -- still within the ≤10% drift allowance", () => {
    const current = { ...base, pageCount: 210 };
    expect(isbnStillValidForEdition(base, current)).toBe(true);
  });

  it("page count +10% exactly -- still valid (boundary inclusive)", () => {
    const current = { ...base, pageCount: 220 };
    expect(isbnStillValidForEdition(base, current)).toBe(true);
  });

  it("page count +11% -- new edition required", () => {
    const current = { ...base, pageCount: 222 };
    expect(isbnStillValidForEdition(base, current)).toBe(false);
  });

  it("page count drops to null while snapshot had one -- can't confirm drift, treated as new edition", () => {
    const current = { ...base, pageCount: null };
    expect(isbnStillValidForEdition(base, current)).toBe(false);
  });

  it("format changed -- new edition required", () => {
    const current = { ...base, printFormatKey: "pocket" };
    expect(isbnStillValidForEdition(base, current)).toBe(false);
  });

  it("trim size changed (custom width) -- new edition required", () => {
    const current = { ...base, printWidthMm: 145 };
    expect(isbnStillValidForEdition(base, current)).toBe(false);
  });

  it("title changed -- new edition required", () => {
    const current = { ...base, title: "Нова назва" };
    expect(isbnStillValidForEdition(base, current)).toBe(false);
  });

  it("primary author changed -- new edition required", () => {
    const current = { ...base, primaryAuthor: "Інший Автор" };
    expect(isbnStillValidForEdition(base, current)).toBe(false);
  });
});

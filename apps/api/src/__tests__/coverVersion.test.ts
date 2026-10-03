import { describe, it, expect } from "vitest";
import { withCoverVersion } from "../lib/coverVersion";

describe("withCoverVersion", () => {
  it("versions coverUrl/backCoverUrl/spineUrl/coverThumbUrl off coverUpdatedAt when present", () => {
    const coverUpdatedAt = new Date("2026-01-01T00:00:00Z");
    const updatedAt = new Date("2026-06-01T00:00:00Z"); // later, but must be ignored
    const result = withCoverVersion({
      coverUrl: "https://x/public/covers/1.webp",
      backCoverUrl: "https://x/public/covers-back/1.png",
      spineUrl: "https://x/public/covers-spine/1.png",
      coverThumbUrl: "https://x/public/covers-thumb/1.webp",
      coverUpdatedAt,
      updatedAt,
    });

    const v = coverUpdatedAt.getTime();
    expect(result.coverUrl).toBe(`https://x/public/covers/1.webp?v=${v}`);
    expect(result.backCoverUrl).toBe(`https://x/public/covers-back/1.png?v=${v}`);
    expect(result.spineUrl).toBe(`https://x/public/covers-spine/1.png?v=${v}`);
    expect(result.coverThumbUrl).toBe(`https://x/public/covers-thumb/1.webp?v=${v}`);
  });

  it("an unrelated field change bumping only updatedAt does NOT change the cache-busting version", () => {
    const coverUpdatedAt = new Date("2026-01-01T00:00:00Z");
    const before = withCoverVersion({ coverUrl: "https://x/c.webp", coverUpdatedAt, updatedAt: new Date("2026-01-02T00:00:00Z") });
    const after = withCoverVersion({ coverUrl: "https://x/c.webp", coverUpdatedAt, updatedAt: new Date("2026-09-01T00:00:00Z") });
    expect(after.coverUrl).toBe(before.coverUrl);
  });

  it("falls back to updatedAt for a legacy row with no coverUpdatedAt yet", () => {
    const updatedAt = new Date("2026-03-01T00:00:00Z");
    const result = withCoverVersion({ coverUrl: "https://x/c.png", coverUpdatedAt: null, updatedAt });
    expect(result.coverUrl).toBe(`https://x/c.png?v=${updatedAt.getTime()}`);
  });

  it("returns the record unchanged when there is no cover-family URL at all", () => {
    const record = { id: "1", title: "No cover", updatedAt: new Date() };
    expect(withCoverVersion(record)).toBe(record);
  });

  it("returns the record unchanged when neither coverUpdatedAt nor updatedAt is a Date (e.g. a select that omitted both)", () => {
    const record = { coverUrl: "https://x/c.png" };
    expect(withCoverVersion(record as any)).toBe(record);
  });

  it("passes through null", () => {
    expect(withCoverVersion(null)).toBeNull();
  });

  it("leaves a null/absent individual field as-is instead of appending ?v= to it", () => {
    const result = withCoverVersion({ coverUrl: "https://x/c.webp", backCoverUrl: null, coverUpdatedAt: new Date() });
    expect(result.backCoverUrl).toBeNull();
  });
});

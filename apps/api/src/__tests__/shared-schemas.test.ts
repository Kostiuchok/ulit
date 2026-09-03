import { describe, it, expect } from "vitest";
import {
  ageRatingSchema,
  distributionChannelsSchema,
  bookAuthorSchema,
  getRequiredDescriptionMinLength,
} from "shared-types";

// Unlike schemas.test.ts's hand-copied mirrors, these import the REAL
// exports apps/api's book.ts/books.ts/distribution.ts actually validate
// against (and apps/web's output-data/BookWizard forms, via the same
// package) -- a regression here means the shared source of truth itself
// broke, not just a stale local copy of it.

describe("ageRatingSchema", () => {
  it("accepts every real rating", () => {
    for (const v of ["0+", "0-6", "6-10", "11-14", "15-17", "18+"]) {
      expect(ageRatingSchema.safeParse(v).success).toBe(true);
    }
  });

  it("rejects an arbitrary string", () => {
    expect(ageRatingSchema.safeParse("13+").success).toBe(false);
  });
});

describe("distributionChannelsSchema", () => {
  it("accepts a valid set including ULIT", () => {
    const result = distributionChannelsSchema.safeParse(["ULIT", "KDP"]);
    expect(result.success).toBe(true);
  });

  it("rejects an empty array", () => {
    expect(distributionChannelsSchema.safeParse([]).success).toBe(false);
  });

  it("rejects a set missing ULIT", () => {
    expect(distributionChannelsSchema.safeParse(["KDP", "GOOGLE"]).success).toBe(false);
  });

  it("rejects an unknown channel", () => {
    expect(distributionChannelsSchema.safeParse(["ULIT", "AMAZON"]).success).toBe(false);
  });
});

describe("bookAuthorSchema", () => {
  it("accepts a minimal valid author", () => {
    const result = bookAuthorSchema.safeParse({ lastName: "Шевченко", firstName: "Тарас" });
    expect(result.success).toBe(true);
  });

  it("rejects a missing firstName", () => {
    expect(bookAuthorSchema.safeParse({ lastName: "Шевченко" }).success).toBe(false);
  });

  it("rejects a name longer than 100 chars", () => {
    expect(bookAuthorSchema.safeParse({ lastName: "a".repeat(101), firstName: "Тарас" }).success).toBe(false);
  });

  it("rejects a non-URL photoUrl", () => {
    expect(
      bookAuthorSchema.safeParse({ lastName: "Шевченко", firstName: "Тарас", photoUrl: "not-a-url" }).success
    ).toBe(false);
  });

  it("accepts a real photoUrl", () => {
    expect(
      bookAuthorSchema.safeParse({ lastName: "Шевченко", firstName: "Тарас", photoUrl: "https://example.com/a.jpg" })
        .success
    ).toBe(true);
  });
});

describe("getRequiredDescriptionMinLength", () => {
  it("falls back to Ulit's own baseline with no channels", () => {
    expect(getRequiredDescriptionMinLength([])).toBe(120);
    expect(getRequiredDescriptionMinLength(null)).toBe(120);
  });

  it("stays at the baseline for D2D-only (D2D's own minimum is lower)", () => {
    expect(getRequiredDescriptionMinLength(["ULIT", "D2D"])).toBe(120);
  });

  it("raises to 250 once KDP is enabled", () => {
    expect(getRequiredDescriptionMinLength(["ULIT", "KDP"])).toBe(250);
  });

  it("raises to 150 once Google is enabled (below KDP's own floor)", () => {
    expect(getRequiredDescriptionMinLength(["ULIT", "GOOGLE"])).toBe(150);
  });

  it("takes the strictest channel when both KDP and Google are enabled", () => {
    expect(getRequiredDescriptionMinLength(["ULIT", "KDP", "GOOGLE"])).toBe(250);
  });
});

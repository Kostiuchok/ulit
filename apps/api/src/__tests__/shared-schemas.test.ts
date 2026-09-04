import { describe, it, expect } from "vitest";
import {
  ageRatingSchema,
  genreSchema,
  GENRES,
  GENRE_TO_PRINT_FORMAT,
  languageSchema,
  LANGUAGES,
  distributionChannelsSchema,
  bookAuthorSchema,
  priceFieldSchema,
  priceInputSchema,
  getRequiredDescriptionMinLength,
  isPublishFieldComplete,
  isReadyToPublish,
  isRejectionReasonResolved,
  toOptionalSelectField,
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

// output-data/page.tsx and BookWizard.tsx both wrap genre AND ageRating with
// this exact helper now (previously two different hand-rolled techniques for
// the same "<select> needs a blank placeholder option" problem).
describe("toOptionalSelectField", () => {
  it("still accepts every real enum value", () => {
    const schema = toOptionalSelectField(ageRatingSchema);
    for (const v of ["0+", "18+"]) {
      expect(schema.safeParse(v).success).toBe(true);
    }
  });

  it("accepts the blank placeholder value", () => {
    expect(toOptionalSelectField(ageRatingSchema).safeParse("").success).toBe(true);
  });

  it("accepts undefined (field never touched)", () => {
    expect(toOptionalSelectField(genreSchema).safeParse(undefined).success).toBe(true);
  });

  it("still rejects a value outside the enum", () => {
    expect(toOptionalSelectField(ageRatingSchema).safeParse("13+").success).toBe(false);
  });
});

describe("languageSchema", () => {
  it("accepts every real language code", () => {
    for (const l of LANGUAGES) {
      expect(languageSchema.safeParse(l.code).success).toBe(true);
    }
  });

  it("has all 9 languages (output-data and BookWizard used to disagree on this count)", () => {
    expect(LANGUAGES.length).toBe(9);
  });

  it("rejects an arbitrary 2-letter code that isn't a real option", () => {
    expect(languageSchema.safeParse("xx").success).toBe(false);
  });
});

describe("genreSchema", () => {
  it("accepts every real genre", () => {
    for (const g of GENRES) {
      expect(genreSchema.safeParse(g).success).toBe(true);
    }
  });

  it("rejects free text that isn't one of the fixed genres", () => {
    expect(genreSchema.safeParse("Кулінарія").success).toBe(false);
  });

  it("rejects an empty string (callers add .or(z.literal(\"\")) themselves if needed)", () => {
    expect(genreSchema.safeParse("").success).toBe(false);
  });

  it("has a print-format mapping for every genre (GENRE_TO_PRINT_FORMAT can't silently miss one)", () => {
    for (const g of GENRES) {
      expect(GENRE_TO_PRINT_FORMAT[g]).toBeDefined();
    }
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

describe("priceFieldSchema (priceEbook/pricePrint/pricePrintHardcover/pricePrintBw/pricePrintHardcoverBw)", () => {
  it("accepts a positive number, null, and undefined", () => {
    expect(priceFieldSchema.safeParse(149.99).success).toBe(true);
    expect(priceFieldSchema.safeParse(null).success).toBe(true);
    expect(priceFieldSchema.safeParse(undefined).success).toBe(true);
  });

  it("rejects zero and negative numbers", () => {
    expect(priceFieldSchema.safeParse(0).success).toBe(false);
    expect(priceFieldSchema.safeParse(-5).success).toBe(false);
  });
});

describe("bookAuthors publish-readiness check (PUBLISH_FIELD_CHECKS' \"bookAuthors\" key)", () => {
  it("rejects an empty author list", () => {
    expect(isPublishFieldComplete("bookAuthors", { bookAuthors: [] })).toBe(false);
  });

  it("rejects a missing bookAuthors field entirely", () => {
    expect(isPublishFieldComplete("bookAuthors", {})).toBe(false);
  });

  it("rejects an author with a blank name", () => {
    expect(isPublishFieldComplete("bookAuthors", { bookAuthors: [{ lastName: "  ", firstName: "" }] })).toBe(false);
  });

  it("accepts at least one author with a real name", () => {
    expect(
      isPublishFieldComplete("bookAuthors", { bookAuthors: [{ lastName: "Шевченко", firstName: "Тарас" }] })
    ).toBe(true);
  });
});

// books.ts's GET /api/books route composes exactly these two primitives into
// a single `needsAttention` flag (T-2078) -- guards that composition against
// either primitive silently changing behavior out from under it.
describe("isReadyToPublish + isRejectionReasonResolved (books.ts's needsAttention)", () => {
  const completeBook = {
    title: "Кобзар",
    description: "А".repeat(150),
    ageRating: "12+",
    coverUrl: "https://example.com/cover.jpg",
    originalDocxUrl: "https://example.com/book.docx",
    priceEbook: 100,
    bookAuthors: [{ lastName: "Шевченко", firstName: "Тарас" }],
  };

  it("is ready to publish once every field check passes", () => {
    expect(isReadyToPublish(completeBook)).toBe(true);
  });

  it("is not ready to publish when any single field is missing (e.g. cover)", () => {
    expect(isReadyToPublish({ ...completeBook, coverUrl: null })).toBe(false);
  });

  it("a rejection reason is unresolved while its flagged field still matches the snapshot", () => {
    const snapshot = { title: "Стара назва" };
    expect(isRejectionReasonResolved("title", { title: "Стара назва" }, snapshot)).toBe(false);
  });

  it("a rejection reason resolves once its flagged field differs from the snapshot", () => {
    const snapshot = { title: "Стара назва" };
    expect(isRejectionReasonResolved("title", { title: "Нова назва" }, snapshot)).toBe(true);
  });

  it("an empty moderationReasons list means no unresolved rejection at all", () => {
    const moderationReasons: string[] = [];
    const hasUnresolvedRejection = moderationReasons.some(
      (key) => !isRejectionReasonResolved(key as any, completeBook, null)
    );
    expect(hasUnresolvedRejection).toBe(false);
  });
});

describe("priceInputSchema (raw <input> state for pricePrintBw/HardcoverBw)", () => {
  it("coerces a non-empty numeric string to a number", () => {
    const result = priceInputSchema.safeParse("149.99");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(149.99);
  });

  it("accepts an empty string as \"not set yet\"", () => {
    const result = priceInputSchema.safeParse("");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("");
  });

  it("rejects a non-numeric string", () => {
    expect(priceInputSchema.safeParse("abc").success).toBe(false);
  });
});

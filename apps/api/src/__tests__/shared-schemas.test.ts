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
  getPublishReadinessFields,
  toOptionalSelectField,
  DEFAULT_PLATFORM_FEE_PERCENT,
  platformFeePercentFromEnv,
  siteRoyaltyRate,
  pendingOrderCutoff,
  PENDING_ORDER_TTL_MS,
  effectivePageCount,
  padPrintPageCount,
  spineThicknessMm,
  isSpineTooThinForText,
  MIN_SPINE_TEXT_THICKNESS_MM,
  resolveExcerptRange,
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

// Both previously left out of PUBLISH_FIELD_CHECKS entirely -- an empty
// Жанр or Біографія автора had no effect on readiness at all.
describe("genre + authorBio publish-readiness checks", () => {
  it("rejects a missing genre", () => {
    expect(isPublishFieldComplete("genre", { genre: null })).toBe(false);
  });

  it("accepts a real genre", () => {
    expect(isPublishFieldComplete("genre", { genre: GENRES[0] })).toBe(true);
  });

  it("rejects a blank/whitespace-only authorBio", () => {
    expect(isPublishFieldComplete("authorBio", { authorBio: "   " })).toBe(false);
  });

  it("accepts a non-empty authorBio", () => {
    expect(isPublishFieldComplete("authorBio", { authorBio: "Народився 1814 року." })).toBe(true);
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
    language: "uk",
    printFormatKey: "standard",
    genre: GENRES[0],
    authorBio: "Народився 1814 року.",
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

  // Journal #32: GET /api/books' own select silently left out printFormatKey
  // -- isReadyToPublish read `undefined` for it on EVERY book, so the
  // sidebar's amber dot was permanently stuck on for every book on the
  // platform. No type error anywhere, because every PublishStepBook field is
  // optional -- a Prisma object missing a column still satisfies the type.
  // Generalizes the single "e.g. cover" case above to every field this
  // fixture actually relies on: catches ANY of them silently becoming
  // non-blocking (the same class of regression, whichever field it hits).
  it("removing any single field this fixture relies on breaks readiness", () => {
    for (const field of Object.keys(completeBook)) {
      const broken = { ...completeBook, [field]: null };
      expect(isReadyToPublish(broken), `expected isReadyToPublish to be false with "${field}" missing`).toBe(false);
    }
  });
});

// The real fix for journal #32: books.ts/publish.ts no longer hand-list which
// fields to SELECT for readiness checks -- they spread this function's
// output instead, so a future PUBLISH_FIELD_CHECKS addition is selected
// automatically with no second edit anywhere. This locks down the field set
// it currently derives, on purpose: a future PUBLISH_FIELD_CHECKS change
// SHOULD make this test fail and force a conscious update here, documenting
// exactly which real DB columns the readiness gate now depends on.
describe("getPublishReadinessFields (the journal #32 fix itself)", () => {
  it("derives exactly the fields every current check reads, including every OR-chain alternative", () => {
    expect(getPublishReadinessFields().sort()).toEqual(
      [
        "title",
        "description",
        "ageRating",
        "language",
        "printFormatKey",
        "genre",
        "authorBio",
        "bookAuthors",
        "coverUrl",
        "originalDocxUrl",
        "pdfUrl",
        "epubUrl",
        "priceEbook",
        "pricePrint",
        "pricePrintHardcover",
        "pricePrintBw",
        "pricePrintHardcoverBw",
        "desiredRoyaltyAmount",
        "desiredRoyaltyAmountPrint",
      ].sort()
    );
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

describe("platform fee / site royalty (T-1501)", () => {
  it("defaults to 30% fee and 70% royalty", () => {
    expect(DEFAULT_PLATFORM_FEE_PERCENT).toBe(30);
    expect(siteRoyaltyRate()).toBe(0.7);
    expect(platformFeePercentFromEnv(undefined)).toBe(30);
  });

  it("reads a valid PLATFORM_FEE_PERCENT override", () => {
    expect(platformFeePercentFromEnv("25")).toBe(25);
    expect(siteRoyaltyRate(25)).toBe(0.75);
  });

  it("rejects empty, zero, 100, and non-numeric env values", () => {
    expect(platformFeePercentFromEnv("")).toBe(30);
    expect(platformFeePercentFromEnv("0")).toBe(30);
    expect(platformFeePercentFromEnv("100")).toBe(30);
    expect(platformFeePercentFromEnv("nope")).toBe(30);
  });
});

describe("pending order TTL (T-2021)", () => {
  it("cutoff is 24 hours before now", () => {
    const now = new Date("2026-09-24T12:00:00.000Z");
    expect(pendingOrderCutoff(now).toISOString()).toBe("2026-09-23T12:00:00.000Z");
    expect(PENDING_ORDER_TTL_MS).toBe(24 * 60 * 60 * 1000);
  });
});

describe("effectivePageCount (T-2055)", () => {
  it("prefers printPageCount over pageCount", () => {
    expect(effectivePageCount({ printPageCount: 48, pageCount: 12 })).toBe(48);
  });

  it("falls back to pageCount when print is missing", () => {
    expect(effectivePageCount({ pageCount: 12 })).toBe(12);
    expect(effectivePageCount({ printPageCount: null, pageCount: 12 })).toBe(12);
  });

  it("returns null for missing or non-positive counts", () => {
    expect(effectivePageCount({})).toBeNull();
    expect(effectivePageCount({ printPageCount: 0, pageCount: 0 })).toBeNull();
  });
});

describe("print page pad and spine (T-2065)", () => {
  it("pads an odd count to the next even page", () => {
    expect(padPrintPageCount(1)).toBe(2);
    expect(padPrintPageCount(47)).toBe(48);
    expect(padPrintPageCount(48)).toBe(48);
  });

  it("does not pad invalid counts", () => {
    expect(padPrintPageCount(0)).toBe(0);
    expect(padPrintPageCount(-3)).toBe(-3);
  });

  it("warns when spine is thinner than 10mm", () => {
    expect(spineThicknessMm(50, false)).toBe(5);
    expect(isSpineTooThinForText(50, false)).toBe(true);
    expect(isSpineTooThinForText(100, false)).toBe(false);
    expect(isSpineTooThinForText(50, true)).toBe(true);
    expect(isSpineTooThinForText(60, true)).toBe(false);
    expect(MIN_SPINE_TEXT_THICKNESS_MM).toBe(10);
  });
});

describe("resolveExcerptRange (F1a)", () => {
  it("uses the author's inclusive page range", () => {
    expect(resolveExcerptRange(3, 5, 48)).toEqual({ start: 3, end: 5 });
  });

  it("defaults to the first five pages when the author left the range empty", () => {
    expect(resolveExcerptRange(null, null, 48)).toEqual({ start: 1, end: 5 });
  });

  it("clamps to the real page count", () => {
    expect(resolveExcerptRange(40, 99, 48)).toEqual({ start: 40, end: 48 });
  });
});

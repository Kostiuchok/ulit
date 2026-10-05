import { describe, it, expect } from "vitest";
import {
  getStoreAnnotationIssues,
  storeAnnotationErrorMessage,
  getDescriptionIssue,
  getOutputDataInfoIssues,
  isPublishStepComplete,
  DESCRIPTION_MIN_LENGTH,
  DESCRIPTION_MAX_LENGTH,
} from "shared-types";

// FORMS-REFACTOR-PLAN.md, етапи 0-1: the rules the "Вихідні дані" form, the
// "Ціна" page and the server all share. Each rule has its own test, so a
// later stage cannot change one unnoticed.

const text = (n: number) => "а".repeat(n);

const complete = {
  title: "Назва",
  description: text(300),
  genre: "poetry",
  printFormatKey: "standard",
  language: "uk",
  ageRating: "0+",
  bookAuthors: [{ lastName: "Шевченко", firstName: "Тарас" }],
  authorBio: "Біографія",
  distributionChannels: ["ULIT", "D2D", "KDP", "GOOGLE"],
};

describe("getStoreAnnotationIssues", () => {
  it("reports nothing for an empty annotation (that is the plain 'required' rule)", () => {
    expect(getStoreAnnotationIssues("", ["KDP", "GOOGLE"])).toEqual([]);
    expect(getStoreAnnotationIssues(null, ["KDP"])).toEqual([]);
  });

  it("ULIT and Draft2Digital never ask for more than the baseline", () => {
    expect(getStoreAnnotationIssues(text(DESCRIPTION_MIN_LENGTH), ["ULIT", "D2D"])).toEqual([]);
  });

  it("Google Play needs 150", () => {
    expect(getStoreAnnotationIssues(text(149), ["GOOGLE"])).toEqual([
      { channel: "GOOGLE", channelName: "Google Play Books", requiredMin: 150 },
    ]);
    expect(getStoreAnnotationIssues(text(150), ["GOOGLE"])).toEqual([]);
  });

  it("Amazon KDP needs 250 -- the live case: 188 characters", () => {
    const issues = getStoreAnnotationIssues(text(188), ["ULIT", "D2D", "KDP", "GOOGLE"]);
    expect(issues.map((i) => i.channel)).toEqual(["KDP"]);
    expect(issues[0].requiredMin).toBe(250);
    expect(getStoreAnnotationIssues(text(250), ["KDP"])).toEqual([]);
  });

  it("lists every store that is not satisfied", () => {
    expect(getStoreAnnotationIssues(text(130), ["KDP", "GOOGLE"]).map((i) => i.channel)).toEqual(["KDP", "GOOGLE"]);
  });

  it("trims before counting", () => {
    expect(getStoreAnnotationIssues(`  ${text(250)}  `, ["KDP"])).toEqual([]);
  });
});

describe("storeAnnotationErrorMessage (the server's rejection text)", () => {
  it("is null when every enabled store is satisfied", () => {
    expect(storeAnnotationErrorMessage(text(250), ["KDP", "GOOGLE"])).toBeNull();
    expect(storeAnnotationErrorMessage("", ["KDP"])).toBeNull();
  });

  it("names the store, the required minimum and the current length", () => {
    const msg = storeAnnotationErrorMessage(text(188), ["ULIT", "KDP"])!;
    expect(msg).toContain("250");
    expect(msg).toContain("Amazon KDP");
    expect(msg).toContain("188");
  });
});

describe("getDescriptionIssue", () => {
  it("empty -> asks for the store-driven minimum", () => {
    expect(getDescriptionIssue("", ["ULIT"])).toContain(String(DESCRIPTION_MIN_LENGTH));
    expect(getDescriptionIssue("   ", ["KDP"])).toContain("250");
  });

  it("below the baseline -> how many characters are missing", () => {
    expect(getDescriptionIssue(text(7), ["ULIT"])).toContain(String(DESCRIPTION_MIN_LENGTH - 7));
  });

  it("baseline met but a store wants more -> names that store", () => {
    const msg = getDescriptionIssue(text(188), ["ULIT", "KDP"])!;
    expect(msg).toContain("Amazon KDP");
    expect(msg).toContain(String(250 - 188));
  });

  it("too long", () => {
    expect(getDescriptionIssue(text(DESCRIPTION_MAX_LENGTH + 3), ["ULIT"])).toContain("3");
  });

  it("acceptable -> null, at both boundaries", () => {
    expect(getDescriptionIssue(text(DESCRIPTION_MIN_LENGTH), ["ULIT", "D2D"])).toBeNull();
    expect(getDescriptionIssue(text(DESCRIPTION_MAX_LENGTH), ["ULIT", "KDP", "GOOGLE"])).toBeNull();
    expect(getDescriptionIssue(text(250), ["KDP"])).toBeNull();
  });
});

describe("getOutputDataInfoIssues", () => {
  it("a complete form has no issues", () => {
    expect(getOutputDataInfoIssues(complete)).toEqual({});
  });

  const required = ["title", "genre", "printFormatKey", "language", "ageRating", "authorBio"] as const;
  for (const field of required) {
    it(`empty ${field} is reported, with a text, and nothing else is`, () => {
      const issues = getOutputDataInfoIssues({ ...complete, [field]: "" });
      expect(Object.keys(issues)).toEqual([field]);
      expect(issues[field]!.length).toBeGreaterThan(5);
    });
  }

  it("whitespace-only title and biography count as empty", () => {
    expect(getOutputDataInfoIssues({ ...complete, title: "   " }).title).toBeTruthy();
    expect(getOutputDataInfoIssues({ ...complete, authorBio: " \n " }).authorBio).toBeTruthy();
  });

  it("no author, or an author without a first name, is reported", () => {
    expect(getOutputDataInfoIssues({ ...complete, bookAuthors: [] }).bookAuthors).toBeTruthy();
    expect(getOutputDataInfoIssues({ ...complete, bookAuthors: [{ lastName: "Шевченко", firstName: " " }] }).bookAuthors).toBeTruthy();
  });

  it("annotation too short for an enabled store is reported on the description field", () => {
    const issues = getOutputDataInfoIssues({ ...complete, description: text(188) });
    expect(Object.keys(issues)).toEqual(["description"]);
    expect(issues.description).toContain("Amazon KDP");
  });

  it("the same annotation is fine once that store is switched off", () => {
    expect(getOutputDataInfoIssues({ ...complete, description: text(188), distributionChannels: ["ULIT", "D2D", "GOOGLE"] })).toEqual({});
  });

  it("issues come in the order the form shows the fields", () => {
    expect(Object.keys(getOutputDataInfoIssues({ distributionChannels: [] }))).toEqual([
      "title",
      "description",
      "genre",
      "printFormatKey",
      "language",
      "ageRating",
      "bookAuthors",
      "authorBio",
    ]);
  });

  it("no issues <=> the 'Вихідні дані' section counts as complete (same gate as publishing)", () => {
    expect(isPublishStepComplete("info", complete)).toBe(true);
    for (const field of [...required, "bookAuthors"] as const) {
      const broken = { ...complete, [field]: field === "bookAuthors" ? [] : "" };
      expect(isPublishStepComplete("info", broken)).toBe(false);
      expect(Object.keys(getOutputDataInfoIssues(broken)).length).toBeGreaterThan(0);
    }
  });
});

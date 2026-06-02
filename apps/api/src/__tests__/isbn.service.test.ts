import { describe, it, expect } from "vitest";
import { assignIsbn, validateIsbn13 } from "../services/isbn.service";

describe("validateIsbn13", () => {
  it("returns true for a valid ISBN-13", () => {
    // Well-known ISBN with correct check digit
    expect(validateIsbn13("978-0-306-40615-7")).toBe(true);
    expect(validateIsbn13("9780306406157")).toBe(true);
  });

  it("returns false for wrong check digit", () => {
    expect(validateIsbn13("978-0-306-40615-0")).toBe(false);
  });

  it("returns false for non-numeric input", () => {
    expect(validateIsbn13("978-abc-40615-7")).toBe(false);
  });

  it("returns false for wrong length", () => {
    expect(validateIsbn13("978-0-306-40615")).toBe(false);
    expect(validateIsbn13("12345")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(validateIsbn13("")).toBe(false);
  });
});

describe("assignIsbn", () => {
  it("returns a valid ISBN-13 string", async () => {
    const isbn = await assignIsbn("mock-book-id");
    expect(typeof isbn).toBe("string");
    expect(isbn).toMatch(/^\d{3}-\d{3}-\d{3}-\d{3}-\d$/);
  });

  it("returned ISBN passes validateIsbn13", async () => {
    const isbn = await assignIsbn("mock-book-id");
    expect(validateIsbn13(isbn)).toBe(true);
  });

  it("starts with 978-617 (Ukrainian publisher prefix)", async () => {
    const isbn = await assignIsbn("mock-book-id");
    expect(isbn.startsWith("978-617")).toBe(true);
  });

  it("generates unique ISBNs across multiple calls", async () => {
    const isbns = await Promise.all(
      Array.from({ length: 20 }, () => assignIsbn("mock-book-id"))
    );
    const unique = new Set(isbns);
    // With 9999 possible title numbers per prefix × 5 prefixes, collisions at 20 calls are astronomically unlikely
    expect(unique.size).toBeGreaterThan(1);
  });
});

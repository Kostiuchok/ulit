import { describe, it, expect } from "vitest";
import { z } from "zod";

// ── Register schema (mirrors apps/api/src/modules/auth/register.ts) ──────────
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
});

// ── Login schema ──────────────────────────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ── Book create schema ────────────────────────────────────────────────────────
const bookCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().max(5000).optional(),
  genre: z.string().max(100).optional(),
  language: z.string().length(2).default("uk"),
  priceEbook: z.number().positive().optional(),
  pricePrint: z.number().positive().optional(),
  distributionStrategy: z.enum(["WIDE", "KDP_SELECT"]).default("WIDE"),
});

// ── User patch schema ─────────────────────────────────────────────────────────
const userPatchSchema = z.object({
  name: z.string().min(2).optional(),
  bio: z.string().max(1000).nullable().optional(),
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
});

// ─────────────────────────────────────────────────────────────────────────────

describe("registerSchema", () => {
  it("accepts valid input", () => {
    const result = registerSchema.safeParse({
      email: "author@example.com",
      password: "secret123",
      name: "Тарас Шевченко",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = registerSchema.safeParse({ email: "not-an-email", password: "secret123", name: "Author" });
    expect(result.success).toBe(false);
  });

  it("rejects password shorter than 8 chars", () => {
    const result = registerSchema.safeParse({ email: "a@b.com", password: "short", name: "Author" });
    expect(result.success).toBe(false);
    expect(result.error?.errors[0].message).toBe("Password must be at least 8 characters");
  });

  it("rejects name shorter than 2 chars", () => {
    const result = registerSchema.safeParse({ email: "a@b.com", password: "secret123", name: "A" });
    expect(result.success).toBe(false);
    expect(result.error?.errors[0].message).toBe("Name must be at least 2 characters");
  });
});

describe("loginSchema", () => {
  it("accepts valid credentials", () => {
    const result = loginSchema.safeParse({ email: "a@b.com", password: "pw" });
    expect(result.success).toBe(true);
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({ email: "a@b.com", password: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = loginSchema.safeParse({ email: "bad", password: "pw" });
    expect(result.success).toBe(false);
  });
});

describe("bookCreateSchema", () => {
  it("accepts minimal valid input", () => {
    const result = bookCreateSchema.safeParse({ title: "My Book" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.language).toBe("uk");
      expect(result.data.distributionStrategy).toBe("WIDE");
    }
  });

  it("rejects empty title", () => {
    const result = bookCreateSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
    expect(result.error?.errors[0].message).toBe("Title is required");
  });

  it("rejects title longer than 255 chars", () => {
    const result = bookCreateSchema.safeParse({ title: "a".repeat(256) });
    expect(result.success).toBe(false);
  });

  it("rejects negative price", () => {
    const result = bookCreateSchema.safeParse({ title: "Book", priceEbook: -1 });
    expect(result.success).toBe(false);
  });

  it("accepts KDP_SELECT strategy", () => {
    const result = bookCreateSchema.safeParse({ title: "Book", distributionStrategy: "KDP_SELECT" });
    expect(result.success).toBe(true);
  });

  it("rejects unknown distribution strategy", () => {
    const result = bookCreateSchema.safeParse({ title: "Book", distributionStrategy: "AMAZON_ONLY" });
    expect(result.success).toBe(false);
  });

  it("rejects language code longer than 2", () => {
    const result = bookCreateSchema.safeParse({ title: "Book", language: "ukr" });
    expect(result.success).toBe(false);
  });
});

describe("userPatchSchema", () => {
  it("accepts valid slug", () => {
    const result = userPatchSchema.safeParse({ slug: "taras-shevchenko" });
    expect(result.success).toBe(true);
  });

  it("rejects slug with uppercase", () => {
    const result = userPatchSchema.safeParse({ slug: "TarasShevchenko" });
    expect(result.success).toBe(false);
  });

  it("rejects slug with spaces", () => {
    const result = userPatchSchema.safeParse({ slug: "taras shevchenko" });
    expect(result.success).toBe(false);
  });

  it("accepts null bio (clearing the field)", () => {
    const result = userPatchSchema.safeParse({ bio: null });
    expect(result.success).toBe(true);
  });

  it("rejects bio longer than 1000 chars", () => {
    const result = userPatchSchema.safeParse({ bio: "x".repeat(1001) });
    expect(result.success).toBe(false);
  });
});

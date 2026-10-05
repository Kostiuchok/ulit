import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Journal #9: presignedGetObject signs against the internal MinIO host
// (http://minio:9000/...). Handed to the browser, that URL is mixed content
// and unreachable. getSignedUrl() must rewrite it onto MINIO_PUBLIC_URL_BASE
// and keep the signature query, including the 48-hour expiry.

const presignedGetObject = vi.hoisted(() => vi.fn());

vi.mock("minio", () => ({
  Client: class {
    presignedGetObject(...args: unknown[]) {
      return presignedGetObject(...args);
    }
  },
}));

const FORTY_EIGHT_HOURS = 48 * 60 * 60;
const RAW =
  "http://minio:9000/knyha-books/private/orders/file.epub?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=172800&X-Amz-Signature=abc";

async function loadSignedUrl() {
  const mod = await import("../services/storage.service");
  return mod.getSignedUrl;
}

describe("getSignedUrl", () => {
  beforeEach(() => {
    vi.resetModules();
    presignedGetObject.mockReset();
    presignedGetObject.mockResolvedValue(RAW);
    process.env.MINIO_BUCKET_NAME = "knyha-books";
  });

  afterEach(() => {
    delete process.env.MINIO_PUBLIC_URL_BASE;
    delete process.env.MINIO_BUCKET_NAME;
  });

  it("asks MinIO for a 48-hour URL and rewrites the internal host onto the public /storage proxy", async () => {
    process.env.MINIO_PUBLIC_URL_BASE = "https://ulit.render.ua/storage";
    const getSignedUrl = await loadSignedUrl();
    const url = await getSignedUrl("private/orders/file.epub");

    expect(presignedGetObject).toHaveBeenCalledWith("knyha-books", "private/orders/file.epub", FORTY_EIGHT_HOURS);
    expect(url).toBe(
      "https://ulit.render.ua/storage/private/orders/file.epub?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=172800&X-Amz-Signature=abc"
    );
    expect(url.startsWith("https://ulit.render.ua/storage/")).toBe(true);
    expect(url).not.toContain("minio:9000");
    expect(url).not.toContain("/knyha-books/");
    const expires = new URL(url).searchParams.get("X-Amz-Expires");
    expect(expires).toBe(String(FORTY_EIGHT_HOURS));
  });

  it("returns the raw MinIO URL only when no public base is configured", async () => {
    delete process.env.MINIO_PUBLIC_URL_BASE;
    const getSignedUrl = await loadSignedUrl();
    const url = await getSignedUrl("private/orders/file.epub");
    expect(url).toBe(RAW);
    expect(presignedGetObject).toHaveBeenCalledWith("knyha-books", "private/orders/file.epub", FORTY_EIGHT_HOURS);
  });
});

import { Client } from "minio";
import { Readable } from "stream";

const minio = new Client({
  endPoint: process.env.MINIO_ENDPOINT || "localhost",
  port: Number(process.env.MINIO_PORT) || 9000,
  useSSL: process.env.MINIO_USE_SSL === "true",
  accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
  secretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
});

const BUCKET = process.env.MINIO_BUCKET_NAME || "knyha-books";
const SIGNED_URL_EXPIRY = 48 * 60 * 60; // 48 hours

async function ensureBucket() {
  const exists = await minio.bucketExists(BUCKET);
  if (!exists) {
    await minio.makeBucket(BUCKET, "us-east-1");
    await minio.setBucketPolicy(
      BUCKET,
      JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { AWS: ["*"] },
            Action: ["s3:GetObject"],
            Resource: [`arn:aws:s3:::${BUCKET}/public/*`],
          },
        ],
      })
    );
  }
}

export async function uploadFile(
  objectName: string,
  stream: Readable,
  size: number,
  contentType: string,
  opts?: { cacheControl?: string }
): Promise<string> {
  await ensureBucket();
  const metadata: Record<string, string> = { "Content-Type": contentType };
  if (opts?.cacheControl) metadata["Cache-Control"] = opts.cacheControl;
  await minio.putObject(BUCKET, objectName, stream, size, metadata);
  return objectName;
}

// Cover/back-cover/spine/thumb objects are written to a fixed, versioned-by-
// query-param key (coverVersion.ts's withCoverVersion) -- once uploaded,
// those exact bytes at that exact URL never change, so the browser (and any
// CDN/proxy in front of /storage) can cache them forever. A re-upload writes
// the SAME object key but bumps coverUpdatedAt, which changes the URL's ?v=
// -- so "immutable" is safe per-URL, never serves stale bytes.
export const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

export async function getSignedUrl(objectName: string): Promise<string> {
  const raw = await minio.presignedGetObject(BUCKET, objectName, SIGNED_URL_EXPIRY);
  // presignedGetObject signs a URL against the internal MinIO endpoint
  // (http://minio:9000/...) -- served as-is, the browser blocks it as mixed
  // content on the HTTPS site. Same fix as publicUrl(): rewrite to the
  // public /storage proxy. The presign signature covers the request path
  // (and, per X-Amz-SignedHeaders=host, the Host header), so this only
  // works because next.config.mjs's /storage rewrite reconstructs the exact
  // same path (bucket + key) and proxies server-side with Host: minio:9000
  // -- i.e. MinIO ends up seeing the identical request it signed, just
  // arriving via the proxy instead of directly.
  const base = process.env.MINIO_PUBLIC_URL_BASE;
  if (!base) return raw;
  const url = new URL(raw);
  const pathWithoutBucket = url.pathname.replace(new RegExp(`^/${BUCKET}/`), "/");
  return `${base}${pathWithoutBucket}${url.search}`;
}

export async function deleteFile(objectName: string): Promise<void> {
  await minio.removeObject(BUCKET, objectName);
}

export function publicUrl(objectName: string): string {
  // In production, MINIO_PUBLIC_URL_BASE points to the Next.js /storage proxy
  // e.g. https://ulit.render.ua/storage — browser hits HTTPS, Next.js fetches from minio internally
  const base = process.env.MINIO_PUBLIC_URL_BASE;
  if (base) return `${base}/${objectName}`;
  // Dev fallback: direct MinIO URL
  const endpoint = process.env.MINIO_ENDPOINT || "localhost";
  const port = process.env.MINIO_PORT || "9000";
  return `http://${endpoint}:${port}/${BUCKET}/${objectName}`;
}

import { Client } from "minio";
import { Readable } from "stream";
import fs from "fs";
import path from "path";

export const minio = new Client({
  endPoint: process.env.MINIO_ENDPOINT || "localhost",
  port: Number(process.env.MINIO_PORT) || 9000,
  useSSL: process.env.MINIO_USE_SSL === "true",
  accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
  secretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
});

const BUCKET = process.env.MINIO_BUCKET_NAME || "knyha-books";

export async function downloadToFile(objectName: string, destPath: string): Promise<void> {
  const stream = await minio.getObject(BUCKET, objectName);
  await new Promise<void>((resolve, reject) => {
    const out = fs.createWriteStream(destPath);
    stream.pipe(out);
    out.on("finish", resolve);
    out.on("error", reject);
  });
}

export async function uploadFromFile(
  objectName: string,
  filePath: string,
  contentType: string
): Promise<void> {
  const stat = fs.statSync(filePath);
  const stream = fs.createReadStream(filePath);
  await minio.putObject(BUCKET, objectName, stream, stat.size, { "Content-Type": contentType });
}

// Mirrors apps/api/src/services/storage.service.ts's publicUrl() -- this
// worker-local copy was missing the MINIO_PUBLIC_URL_BASE rewrite, so every
// URL it produced (manuscript-imported images) pointed at the internal
// Docker-network `minio:9000` host, unreachable from the browser and (on
// the HTTPS site) blocked as mixed content -- images silently never
// rendered even though the map/lookup logic upstream was fully correct.
export function publicUrl(objectName: string): string {
  const base = process.env.MINIO_PUBLIC_URL_BASE;
  if (base) return `${base}/${objectName}`;
  const endpoint = process.env.MINIO_ENDPOINT || "localhost";
  const port = process.env.MINIO_PORT || "9000";
  const protocol = process.env.MINIO_USE_SSL === "true" ? "https" : "http";
  return `${protocol}://${endpoint}:${port}/${BUCKET}/${objectName}`;
}

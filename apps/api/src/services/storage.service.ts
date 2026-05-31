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
  contentType: string
): Promise<string> {
  await ensureBucket();
  await minio.putObject(BUCKET, objectName, stream, size, { "Content-Type": contentType });
  return objectName;
}

export async function getSignedUrl(objectName: string): Promise<string> {
  return minio.presignedGetObject(BUCKET, objectName, SIGNED_URL_EXPIRY);
}

export async function deleteFile(objectName: string): Promise<void> {
  await minio.removeObject(BUCKET, objectName);
}

export function publicUrl(objectName: string): string {
  const endpoint = process.env.MINIO_ENDPOINT || "localhost";
  const port = process.env.MINIO_PORT || "9000";
  const protocol = process.env.MINIO_USE_SSL === "true" ? "https" : "http";
  return `${protocol}://${endpoint}:${port}/${BUCKET}/${objectName}`;
}

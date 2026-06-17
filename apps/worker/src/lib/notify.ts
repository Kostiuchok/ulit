const API_URL = process.env.API_URL || "http://localhost:3001";
const WORKER_SECRET = process.env.WORKER_SECRET || "worker-secret-dev";

export async function notifyJobStatus(
  bookId: string,
  format: string,
  status: "PROCESSING" | "DONE" | "FAILED",
  opts?: { error?: string; outputObjectName?: string }
) {
  await fetch(`${API_URL}/api/books/${bookId}/job-status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-worker-secret": WORKER_SECRET,
    },
    body: JSON.stringify({ format, status, ...opts }),
  });
}

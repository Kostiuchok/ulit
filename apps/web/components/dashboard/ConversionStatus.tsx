"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useApi } from "../../hooks/useApi";
import { cn } from "../../lib/utils";

interface ConversionJob {
  format: string;
  status: "PENDING" | "PROCESSING" | "DONE" | "FAILED";
  error?: string | null;
  updatedAt: string;
}

interface Props {
  bookId: string;
  active: boolean;
  onDone?: (bookStatus: string) => void;
}

const FORMAT_LABELS: Record<string, string> = {
  PDF: "PDF (онлайн)",
  EPUB: "EPUB",
  FB2: "FB2",
  MOBI: "MOBI / AZW3",
  PRINT_PDF: "PDF (друк)",
};

const STATUS_CONFIG = {
  PENDING: { icon: "⏳", label: "В черзі", className: "text-gray-500" },
  PROCESSING: { icon: "⚙️", label: "Конвертація…", className: "text-blue-600" },
  DONE: { icon: "✓", label: "Готово", className: "text-green-600" },
  FAILED: { icon: "✗", label: "Помилка", className: "text-red-500" },
};

export function ConversionStatus({ bookId, active, onDone }: Props) {
  const { apiFetch } = useApi();
  const [jobs, setJobs] = useState<ConversionJob[]>([]);
  const [bookStatus, setBookStatus] = useState<string>("");
  const notifiedRef = useRef(false);

  const poll = useCallback(async () => {
    try {
      const data = await apiFetch<{ bookStatus: string; jobs: ConversionJob[] }>(
        `/api/books/${bookId}/conversion-status`
      );
      setJobs(data.jobs);
      setBookStatus(data.bookStatus);

      const allDone = data.jobs.every((j) => j.status === "DONE" || j.status === "FAILED");
      if (allDone && !notifiedRef.current) {
        notifiedRef.current = true;
        onDone?.(data.bookStatus);
      }
    } catch {
      // ignore polling errors
    }
  }, [bookId, onDone]);

  useEffect(() => {
    if (!active) return;
    notifiedRef.current = false;
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [active, poll]);

  if (!active || jobs.length === 0) return null;

  const allDone = jobs.every((j) => j.status === "DONE" || j.status === "FAILED");

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Конвертація форматів</h3>
        {!allDone && (
          <span className="flex items-center gap-1.5 text-xs text-blue-600">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-600" />
            В процесі
          </span>
        )}
        {allDone && bookStatus === "REVIEW" && (
          <span className="text-xs text-green-600 font-medium">✓ Готово до перевірки</span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {jobs.map((job) => {
          const cfg = STATUS_CONFIG[job.status];
          return (
            <div
              key={job.format}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-3 py-2 text-sm",
                job.status === "DONE" && "border-green-200 bg-green-50",
                job.status === "FAILED" && "border-red-200 bg-red-50",
                job.status === "PROCESSING" && "border-blue-200 bg-blue-50",
                job.status === "PENDING" && "border-gray-200 bg-gray-50"
              )}
            >
              <span className="text-base">{cfg.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800">{FORMAT_LABELS[job.format] ?? job.format}</p>
                <p className={cn("text-xs", cfg.className)}>{cfg.label}</p>
                {job.status === "FAILED" && job.error && (
                  <p className="text-xs text-red-500 truncate mt-0.5" title={job.error}>
                    {job.error}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

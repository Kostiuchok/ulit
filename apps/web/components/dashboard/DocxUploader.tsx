"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { useApi } from "../../hooks/useApi";

interface Props {
  bookId: string;
  currentDocxUrl?: string | null;
  onUploadSuccess: () => void;
}

export function DocxUploader({ bookId, currentDocxUrl, onUploadSuccess }: Props) {
  const { token } = useApi();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"upload" | "processing">("upload");
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const onDrop = useCallback((files: File[]) => {
    setSelectedFile(files[0] ?? null);
    setError("");
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
    maxSize: 50 * 1024 * 1024,
    multiple: false,
    onDropRejected: (rejections) => {
      const err = rejections[0]?.errors[0];
      setError(err?.code === "file-too-large" ? "Файл перевищує 50 MB" : "Тільки .docx файли");
    },
  });

  async function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);
    setError("");
    setProgress(0);
    setPhase("upload");

    const form = new FormData();
    form.append("file", selectedFile);

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          // Reserve last 5% for server-side processing
          setProgress(Math.round((e.loaded / e.total) * 95));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setProgress(100);
          setPhase("processing");
          setSelectedFile(null);
          resolve();
          // Brief delay so user sees 100% before parent hides the uploader
          setTimeout(() => onUploadSuccess(), 300);
        } else {
          const body = JSON.parse(xhr.responseText || "{}");
          reject(new Error(body.error || `Помилка ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error("Помилка мережі"));
      xhr.ontimeout = () => reject(new Error("Час очікування вичерпано"));

      xhr.open("POST", `/api/books/${bookId}/upload-docx`);
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.timeout = 5 * 60 * 1000; // 5 min for large files
      xhr.send(form);
    }).catch((e: any) => {
      setError(e.message || "Помилка завантаження");
    }).finally(() => {
      setUploading(false);
    });
  }

  const progressLabel = phase === "processing"
    ? "Обробляється на сервері…"
    : `Завантаження… ${progress}%`;

  return (
    <div className="space-y-4">
      {currentDocxUrl && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">
          <span>✓</span>
          <span>Рукопис завантажено. Ви можете завантажити нову версію.</span>
        </div>
      )}

      <div
        {...getRootProps()}
        className={cn(
          "relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors",
          isDragActive
            ? "border-primary bg-primary/5"
            : selectedFile
            ? "border-green-400 bg-green-50"
            : "border-gray-300 hover:border-gray-400"
        )}
      >
        <input {...getInputProps()} />
        <div className="text-4xl mb-3">{selectedFile ? "📄" : "📁"}</div>
        {selectedFile ? (
          <>
            <p className="font-medium text-gray-900">{selectedFile.name}</p>
            <p className="text-xs text-gray-500 mt-1">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </>
        ) : isDragActive ? (
          <p className="text-gray-600">Відпустіть файл тут…</p>
        ) : (
          <>
            <p className="font-medium text-gray-700">Перетягніть .docx або натисніть для вибору</p>
            <p className="text-xs text-gray-400 mt-1">Максимум 50 MB</p>
          </>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {uploading && (
        <div className="space-y-1.5">
          <div className="h-2.5 w-full rounded-full bg-gray-200 overflow-hidden">
            <div
              className={cn(
                "h-2.5 rounded-full transition-all duration-200",
                phase === "processing" ? "bg-green-500 animate-pulse" : "bg-primary"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{progressLabel}</span>
            {phase === "upload" && <span>{progress}%</span>}
          </div>
        </div>
      )}

      {selectedFile && !uploading && (
        <div className="flex gap-2">
          <Button onClick={handleUpload}>
            Завантажити та конвертувати
          </Button>
          <Button variant="outline" onClick={() => setSelectedFile(null)}>
            Скасувати
          </Button>
        </div>
      )}
    </div>
  );
}

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
  const { apiUpload } = useApi();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
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
    setProgress(10);

    try {
      const form = new FormData();
      form.append("file", selectedFile);
      setProgress(40);
      await apiUpload(`/api/books/${bookId}/upload-docx`, form);
      setProgress(100);
      setSelectedFile(null);
      onUploadSuccess();
    } catch (e: any) {
      setError(e.message || "Помилка завантаження");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

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

      {uploading && progress > 0 && (
        <div className="space-y-1">
          <div className="h-2 w-full rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 text-right">{progress}%</p>
        </div>
      )}

      {selectedFile && (
        <div className="flex gap-2">
          <Button onClick={handleUpload} loading={uploading}>
            Завантажити та конвертувати
          </Button>
          <Button variant="outline" onClick={() => setSelectedFile(null)} disabled={uploading}>
            Скасувати
          </Button>
        </div>
      )}
    </div>
  );
}

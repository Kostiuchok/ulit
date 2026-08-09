"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { FileText } from "lucide-react";

interface Props {
  files: File[];
  onChange: (files: File[]) => void;
}

const MAX_SIZE = 15 * 1024 * 1024;

export function IdentityDocsUploader({ files, onChange }: Props) {
  const [error, setError] = useState("");

  const onDrop = useCallback(
    (accepted: File[]) => {
      setError("");
      onChange([...files, ...accepted]);
    },
    [files, onChange]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/jpeg": [], "image/png": [], "application/pdf": [] },
    maxSize: MAX_SIZE,
    multiple: true,
    onDropRejected: () => setError("Файл повинен бути jpeg/png/pdf до 15 MB"),
  });

  function removeFile(index: number) {
    onChange(files.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={`cursor-pointer rounded-lg border-2 border-dashed px-6 py-8 text-center text-sm transition-colors ${
          isDragActive ? "border-primary bg-primary/5" : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <input {...getInputProps()} />
        <p className="text-gray-600">Перетягніть файли сюди</p>
        <p className="text-gray-400">
          або <span className="font-semibold underline">виберіть файли</span>
        </p>
        <p className="mt-2 text-xs text-gray-400">Формати: jpeg/jpg, png, pdf</p>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((file, i) => (
            <li key={`${file.name}-${i}`} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span className="flex items-center gap-2 truncate text-gray-700">
                <FileText size={14} className="shrink-0 text-gray-400" />
                {file.name}
              </span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="shrink-0 text-xs font-medium text-red-500 hover:underline"
              >
                Видалити
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

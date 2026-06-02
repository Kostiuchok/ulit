"use client";

import { useState, useRef, useCallback } from "react";
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { useDropzone } from "react-dropzone";
import { Button } from "../ui/button";
import { useApi } from "../../hooks/useApi";

interface Props {
  currentAvatarUrl?: string | null;
  onSuccess: (avatarUrl: string) => void;
}

function centerAspectCrop(width: number, height: number): Crop {
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 90 }, 1, width, height),
    width,
    height
  );
}

export function AvatarUploader({ currentAvatarUrl, onSuccess }: Props) {
  const { apiUpload } = useApi();
  const [imgSrc, setImgSrc] = useState("");
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const imgRef = useRef<HTMLImageElement>(null);

  const onDrop = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImgSrc(reader.result as string);
    reader.readAsDataURL(file);
    setError("");
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
    maxSize: 5 * 1024 * 1024,
    multiple: false,
    onDropRejected: () => setError("Файл повинен бути JPEG/PNG/WebP до 5 MB"),
  });

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height));
  }

  async function handleUpload() {
    if (!completedCrop || !imgRef.current) return;
    setUploading(true);
    setError("");

    try {
      const canvas = document.createElement("canvas");
      const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
      const scaleY = imgRef.current.naturalHeight / imgRef.current.height;
      canvas.width = completedCrop.width * scaleX;
      canvas.height = completedCrop.height * scaleY;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(
        imgRef.current,
        completedCrop.x * scaleX,
        completedCrop.y * scaleY,
        completedCrop.width * scaleX,
        completedCrop.height * scaleY,
        0,
        0,
        canvas.width,
        canvas.height
      );

      const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.9));
      const form = new FormData();
      form.append("file", blob, "avatar.jpg");

      const data = await apiUpload<{ avatarUrl: string }>("/api/users/me/avatar", form);
      onSuccess(data.avatarUrl);
      setImgSrc("");
    } catch (e: any) {
      setError(e.message || "Помилка завантаження");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        {currentAvatarUrl ? (
          <img
            src={currentAvatarUrl}
            alt="Аватар"
            className="h-20 w-20 rounded-full object-cover ring-2 ring-border"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted text-3xl">
            👤
          </div>
        )}
        <div
          {...getRootProps()}
          className={`cursor-pointer rounded-lg border-2 border-dashed px-6 py-3 text-sm transition-colors ${
            isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
          }`}
        >
          <input {...getInputProps()} />
          {isDragActive ? "Відпустіть файл…" : "Завантажити фото"}
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {imgSrc && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Обріжте фото (1:1)</p>
          <div className="max-w-sm">
            <ReactCrop
              crop={crop}
              onChange={(_, pc) => setCrop(pc)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={1}
              circularCrop
            >
              <img
                ref={imgRef}
                src={imgSrc}
                onLoad={onImageLoad}
                className="max-h-64 max-w-full"
                alt="preview"
              />
            </ReactCrop>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleUpload} loading={uploading} size="sm">
              Зберегти фото
            </Button>
            <Button variant="outline" size="sm" onClick={() => setImgSrc("")}>
              Скасувати
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../ui/button";
import { useApi } from "../../hooks/useApi";

interface ValidationError {
  field: string;
  message: string;
}

interface Props {
  bookId: string;
  bookStatus: string;
  onPublished?: () => void;
}

export function PublishButton({ bookId, bookStatus, onPublished }: Props) {
  const { apiFetch } = useApi();
  const router = useRouter();
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (bookStatus === "PUBLISHED") {
    return (
      <div className="rounded-md bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">
        ✓ Книга опублікована
      </div>
    );
  }

  if (bookStatus === "PROCESSING") {
    return (
      <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-2 text-sm text-blue-700">
        ⚙ Файли конвертуються, зачекайте…
      </div>
    );
  }

  async function handleValidate() {
    setValidating(true);
    setErrors([]);
    try {
      const data = await apiFetch<{ valid: boolean; errors: ValidationError[] }>(
        `/api/books/${bookId}/publish/validate`
      );
      if (data.valid) {
        setShowConfirm(true);
      } else {
        setErrors(data.errors);
      }
    } catch (e: any) {
      setErrors([{ field: "general", message: e.message || "Помилка перевірки" }]);
    } finally {
      setValidating(false);
    }
  }

  async function handlePublish() {
    setLoading(true);
    setErrors([]);
    try {
      await apiFetch(`/api/books/${bookId}/publish`, { method: "POST" });
      onPublished?.();
      router.push(`/dashboard/books/${bookId}/published`);
    } catch (e: any) {
      if (e.message?.includes("errors")) {
        try {
          const parsed = JSON.parse(e.message);
          setErrors(parsed.errors ?? []);
        } catch {
          setErrors([{ field: "general", message: e.message }]);
        }
      } else {
        setErrors([{ field: "general", message: e.message || "Помилка публікації" }]);
      }
      setShowConfirm(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {!showConfirm ? (
        <Button onClick={handleValidate} loading={validating} className="w-full">
          Опублікувати книгу →
        </Button>
      ) : (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-3">
          <p className="text-sm font-semibold text-green-800">✓ Книга готова до публікації</p>
          <p className="text-xs text-green-700">
            Після публікації книга отримає ISBN та стане доступна в магазині.
            Автор акцептує публічну оферту.
          </p>
          <div className="flex gap-2">
            <Button onClick={handlePublish} loading={loading} className="flex-1">
              Підтвердити публікацію
            </Button>
            <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={loading}>
              Скасувати
            </Button>
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 space-y-1">
          <p className="text-xs font-semibold text-red-700">Необхідно виправити перед публікацією:</p>
          <ul className="space-y-0.5">
            {errors.map((err, i) => (
              <li key={i} className="text-xs text-red-600">• {err.message}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

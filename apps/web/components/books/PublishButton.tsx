"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "../ui/button";
import { useApi } from "../../hooks/useApi";

interface ValidationError {
  field: string;
  message: string;
}

interface Props {
  bookId: string;
  bookStatus: string;
  reviewDone?: boolean;
  onSubmitted?: () => void;
}

export function PublishButton({ bookId, bookStatus, reviewDone, onSubmitted }: Props) {
  const { apiFetch } = useApi();
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [contractRequired, setContractRequired] = useState(false);
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

  if (bookStatus === "REVIEW") {
    if (reviewDone) {
      return (
        <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-2 text-sm text-blue-700">
          ✓ Перевірку пройдено — очікуйте на публікацію у магазинах
        </div>
      );
    }
    return (
      <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-700">
        ⏳ На модерації — очікує на перевірку адміністратором
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

  async function handleSubmit() {
    setLoading(true);
    setErrors([]);
    setContractRequired(false);
    try {
      await apiFetch(`/api/books/${bookId}/publish`, { method: "POST", body: JSON.stringify({}) });
      onSubmitted?.();
    } catch (e: any) {
      if (e.code === "CONTRACT_NOT_SIGNED") {
        setContractRequired(true);
      } else {
        setErrors([{ field: "general", message: e.message || "Помилка надсилання" }]);
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
          Надіслати на модерацію →
        </Button>
      ) : (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-3">
          <p className="text-sm font-semibold text-green-800">✓ Книга готова до модерації</p>
          <p className="text-xs text-green-700">
            Адміністратор перевірить книгу. Ви отримаєте email, щойно перевірку завершено і книгу опубліковано
            (буде призначено ISBN). Автор акцептує публічну оферту.
          </p>
          <div className="flex gap-2">
            <Button onClick={handleSubmit} loading={loading} className="flex-1">
              Підтвердити надсилання
            </Button>
            <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={loading}>
              Скасувати
            </Button>
          </div>
        </div>
      )}

      {contractRequired && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-1.5">
          <p className="text-xs text-amber-800">Спочатку підпишіть договір з платформою — він укладається один раз і діє на всі ваші книги.</p>
          <Link href="/dashboard/settings/contract" className="text-xs font-semibold text-amber-900 underline hover:no-underline">
            Підписати договір →
          </Link>
        </div>
      )}

      {errors.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 space-y-1">
          <p className="text-xs font-semibold text-red-700">Необхідно виправити перед надсиланням:</p>
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

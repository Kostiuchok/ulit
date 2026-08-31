"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "../ui/button";
import { useApi } from "../../hooks/useApi";
import { cn } from "../../lib/utils";

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
  const [appearanceConfirmed, setAppearanceConfirmed] = useState(false);

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
      await apiFetch(`/api/books/${bookId}/publish`, {
        method: "POST",
        body: JSON.stringify({ appearanceConfirmed }),
      });
      onSubmitted?.();
      // AuthorBooksSidebar fetches its own book list independently and has
      // no other way to learn the status just changed to REVIEW in the same tab.
      window.dispatchEvent(new Event("ulit:books-changed"));
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

  // showConfirm's panel (and the contract/error notices below it) are wide,
  // multi-line message boxes -- in BookDashboard.tsx this component sits as
  // one item in a `flex flex-wrap` row of toolbar buttons alongside
  // "Редагувати"/"Сайт книги", so left at shrink-to-content width they
  // squeezed into that row and broke it. `w-full` forces this component's
  // root onto its own full-width flex line whenever there's more than just
  // the trigger button to show; harmless in output-data/page.tsx's other
  // usage, which already wraps it in its own full-width block container.
  const expanded = showConfirm || contractRequired || errors.length > 0;

  return (
    <div className={cn("space-y-3", expanded && "w-full")}>
      {!showConfirm ? (
        <Button onClick={handleValidate} loading={validating} className="w-full">
          Надіслати на модерацію →
        </Button>
      ) : (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-green-800">✓ Книга готова до модерації</p>
              <p className="text-xs text-green-700">
                Адміністратор перевірить книгу. Ви отримаєте email, щойно перевірку завершено і книгу
                опубліковано (буде призначено ISBN). Автор акцептує публічну оферту.
              </p>
            </div>
            <div className="space-y-3">
              <label className="flex items-start gap-2 text-xs text-green-900">
                <input
                  type="checkbox"
                  checked={appearanceConfirmed}
                  onChange={(e) => setAppearanceConfirmed(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300"
                />
                Мене влаштовує вигляд книги (обкладинка, передперегляд рукопису) — я переглянув(ла) і
                готовий(а) до модерації.
              </label>
              <div className="flex gap-2">
                <Button onClick={handleSubmit} loading={loading} disabled={!appearanceConfirmed} className="flex-1">
                  Підтвердити надсилання
                </Button>
                <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={loading}>
                  Скасувати
                </Button>
              </div>
            </div>
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

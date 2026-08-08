"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StepRow } from "@/components/books/StepRow";
import { useApi } from "@/hooks/useApi";
import { useBook } from "@/hooks/useBook";
import { cn } from "@/lib/utils";
import { BOOK_STATUS_LABELS } from "@/lib/bookStatus";

interface OverviewBook {
  title: string;
  status: string;
  moderationStatus?: string | null;
  moderationNote?: string | null;
  originalDocxUrl?: string | null;
  pdfUrl?: string | null;
  coverUrl?: string | null;
}

export default function BookOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { apiFetch } = useApi();
  const { book, loading } = useBook<OverviewBook>(id);
  const [mountTime] = useState(() => Date.now());

  async function handleDelete() {
    if (!confirm("Видалити книгу? Цю дію не можна скасувати.")) return;
    try {
      await apiFetch(`/api/books/${id}`, { method: "DELETE" });
      router.push("/dashboard/books");
    } catch (e: any) {
      alert(e.message || "Помилка видалення");
    }
  }

  if (loading) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="h-8 bg-gray-200 rounded w-64 animate-pulse mb-6" />
        <div className="h-96 bg-gray-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  const status = BOOK_STATUS_LABELS[book?.status ?? "DRAFT"] ?? BOOK_STATUS_LABELS.DRAFT;
  const hasManuscript = !!book?.originalDocxUrl;
  const hasConversion = !!book?.pdfUrl;
  const hasCover = !!book?.coverUrl;
  const canPublish = hasManuscript && hasConversion && hasCover && book?.status !== "PROCESSING";

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/books" className="text-sm text-gray-500 hover:text-gray-700">
              ← Мої книги
            </Link>
            <span className="text-gray-300">/</span>
            <h1 className="text-lg font-semibold text-gray-900 truncate max-w-xs">{book?.title}</h1>
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", status.className)}>
              {status.label}
            </span>
          </div>
          {book?.status !== "PUBLISHED" && (
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              Видалити
            </Button>
          )}
        </div>

        {/* Rejection banner */}
        {book?.moderationStatus === "REJECTED" && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-red-600 text-lg">✕</span>
              <p className="font-semibold text-red-800">Книгу відхилено модератором</p>
            </div>
            {book.moderationNote ? (
              <p className="text-sm text-red-700 whitespace-pre-wrap">{book.moderationNote}</p>
            ) : (
              <p className="text-sm text-red-600">Причину не вказано. Зверніться до підтримки.</p>
            )}
            <p className="text-xs text-red-500">
              Виправте зазначені недоліки та надішліть книгу на публікацію повторно.
            </p>
          </div>
        )}

        {/* Cover thumbnail */}
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            {book?.coverUrl ? (
              <img
                src={`${book.coverUrl.split("?")[0]}?t=${mountTime}`}
                alt=""
                className="h-36 w-28 rounded-md object-cover shadow"
              />
            ) : (
              <div className="flex h-36 w-28 items-center justify-center rounded-md bg-gray-100 text-4xl">
                📖
              </div>
            )}
            <div>
              <p className="text-sm text-gray-500 mb-2">
                {hasCover
                  ? "Обкладинку додано. Можна редагувати."
                  : "Створіть або завантажте обкладинку 1800×2700 px (2:3, 300 DPI)."}
              </p>
              <Link href={`/dashboard/books/${id}/cover`}>
                <Button variant="outline" size="sm">
                  {hasCover ? "Редагувати обкладинку" : "Додати обкладинку →"}
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Readiness checklist */}
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold mb-1">Готовність до публікації</h2>
          <p className="text-xs text-gray-500 mb-4">
            Виконайте всі кроки, щоб опублікувати книгу в магазині
          </p>
          <div className="divide-y">
            <StepRow
              num={1}
              done={hasManuscript}
              label="Завантажено рукопис (.docx)"
              hint="Перетягніть .docx файл у розділ «Рукопис»"
              action={{ label: "Рукопис", href: `/dashboard/books/${id}/manuscript` }}
            />
            <StepRow
              num={2}
              done={hasConversion}
              label="Конвертацію завершено"
              hint={book?.status === "PROCESSING" ? "Зачекайте завершення конвертації…" : "Буде автоматично після завантаження"}
            />
            <StepRow
              num={3}
              done={hasCover}
              label="Додано обкладинку"
              hint="Обкладинка потрібна для публікації в магазині"
              action={{ label: "Обкладинка", href: `/dashboard/books/${id}/cover` }}
            />
          </div>
          {canPublish && book?.status !== "PUBLISHED" && (
            <Link href={`/dashboard/books/${id}/publish`} className="mt-4 block">
              <Button className="w-full">Перейти до публікації →</Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

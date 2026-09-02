"use client";

import { useState } from "react";
import { useApi } from "../../hooks/useApi";

interface Props {
  bookId: string;
  docxUpdatedAt?: string | null;
  publishedAt?: string | null;
  republishRequestedAt?: string | null;
  // Staged Назва/Анотація/Жанр (book.ts's PATCH writes here instead of the
  // live field while status is PUBLISHED) -- non-null means "waiting to be
  // sent for re-moderation", same signal docxUpdatedAt already gives for a
  // re-uploaded manuscript.
  pendingTitle?: string | null;
  pendingDescription?: string | null;
  pendingGenre?: string | null;
  onSubmitted?: (republishRequestedAt: string) => void;
}

export function RepublishButton({
  bookId,
  docxUpdatedAt,
  publishedAt,
  republishRequestedAt,
  pendingTitle,
  pendingDescription,
  pendingGenre,
  onSubmitted,
}: Props) {
  const { apiFetch } = useApi();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasDocxChanges = !!docxUpdatedAt && (!publishedAt || docxUpdatedAt > publishedAt);
  const pendingFields = [
    pendingTitle != null && "назву",
    pendingDescription != null && "анотацію",
    pendingGenre != null && "жанр",
  ].filter(Boolean) as string[];
  const hasChanges = hasDocxChanges || pendingFields.length > 0;
  // republishRequestedAt is always cleared by the admin's approve/reject
  // (admin.ts) -- its mere presence means a request is already in flight.
  const isPending = !!republishRequestedAt;

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const { book } = await apiFetch<{ book: { republishRequestedAt: string } }>(
        `/api/books/${bookId}/republish`,
        { method: "POST", body: JSON.stringify({}) }
      );
      onSubmitted?.(book.republishRequestedAt);
    } catch (e: any) {
      setError(e.message || "Помилка надсилання змін");
    } finally {
      setLoading(false);
    }
  }

  if (isPending) {
    return (
      <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-700">
        ⏳ Зміни на модерації
        {pendingFields.length > 0 && (
          <span className="block text-xs text-amber-600 mt-0.5">
            Очікують: {pendingFields.join(", ")}{hasDocxChanges && (pendingFields.length > 0 ? ", рукопис" : "рукопис")}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <button
          onClick={handleClick}
          disabled={!hasChanges || loading}
          title={hasChanges ? "Надіслати зміни на повторну модерацію" : "Немає нових незбережених змін"}
          className={
            hasChanges
              ? "rounded-md border border-black px-4 py-2 text-sm text-black hover:bg-gray-50 disabled:opacity-50"
              : "rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-300 cursor-not-allowed"
          }
        >
          {loading ? "Надсилаємо…" : "Опублікувати із змінами"}
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
      {pendingFields.length > 0 && (
        <p className="text-xs text-gray-400">
          Ще не на сайті — очікує на надсилання: {pendingFields.join(", ")}
          {hasDocxChanges && (pendingFields.length > 0 ? ", рукопис" : "рукопис")}.
        </p>
      )}
    </div>
  );
}

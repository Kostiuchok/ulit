"use client";

import { useState } from "react";
import { useApi } from "../../hooks/useApi";

interface Props {
  bookId: string;
  docxUpdatedAt?: string | null;
  publishedAt?: string | null;
  republishRequestedAt?: string | null;
  onSubmitted?: (republishRequestedAt: string) => void;
}

export function RepublishButton({
  bookId,
  docxUpdatedAt,
  publishedAt,
  republishRequestedAt,
  onSubmitted,
}: Props) {
  const { apiFetch } = useApi();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasChanges = !!docxUpdatedAt && (!publishedAt || docxUpdatedAt > publishedAt);
  const isPending = !!republishRequestedAt && !!docxUpdatedAt && republishRequestedAt >= docxUpdatedAt;

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
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleClick}
        disabled={!hasChanges || loading}
        title={hasChanges ? "Надіслати зміни на повторну модерацію" : "Немає нових змін у рукопису"}
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
  );
}

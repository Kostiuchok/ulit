"use client";

import { useState } from "react";
import { useApi } from "../../hooks/useApi";

interface Props {
  bookId: string;
  docxUpdatedAt?: string | null;
  publishedAt?: string | null;
  onRepublished?: (publishedAt: string) => void;
}

export function RepublishButton({ bookId, docxUpdatedAt, publishedAt, onRepublished }: Props) {
  const { apiFetch } = useApi();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasChanges = !!docxUpdatedAt && (!publishedAt || docxUpdatedAt > publishedAt);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const { book } = await apiFetch<{ book: { publishedAt: string } }>(
        `/api/books/${bookId}/republish`,
        { method: "POST", body: JSON.stringify({}) }
      );
      onRepublished?.(book.publishedAt);
    } catch (e: any) {
      setError(e.message || "Помилка публікації змін");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleClick}
        disabled={!hasChanges || loading}
        title={hasChanges ? "Оновити файли на основі нового рукопису" : "Немає нових змін у рукопису"}
        className={
          hasChanges
            ? "rounded-md border border-black px-4 py-2 text-sm text-black hover:bg-gray-50 disabled:opacity-50"
            : "rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-300 cursor-not-allowed"
        }
      >
        {loading ? "Публікуємо…" : "Опублікувати із змінами"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

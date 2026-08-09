"use client";

import { useState } from "react";
import { useApi } from "../../hooks/useApi";

interface Props {
  bookId: string;
  onRelisted?: () => void;
}

export function RelistButton({ bookId, onRelisted }: Props) {
  const { apiFetch } = useApi();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      await apiFetch(`/api/books/${bookId}/relist`, { method: "POST", body: JSON.stringify({}) });
      onRelisted?.();
    } catch (e: any) {
      setError(e.message || "Помилка публікації");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleClick}
        disabled={loading}
        className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {loading ? "Публікуємо…" : "Опублікувати знову"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

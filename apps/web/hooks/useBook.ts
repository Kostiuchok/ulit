import { useCallback, useEffect, useState } from "react";
import { useApi } from "./useApi";

export function useBook<T = any>(id: string | undefined) {
  const { apiFetch, token } = useApi();
  const [book, setBook] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    if (!token || !id) return;
    setLoading(true);
    return apiFetch<{ book: T }>(`/api/books/${id}`)
      .then(({ book }) => {
        setBook(book);
        setError(null);
      })
      .catch((e: any) => setError(e.message || "Помилка завантаження"))
      .finally(() => setLoading(false));
  }, [token, id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { book, setBook, loading, error, refetch };
}

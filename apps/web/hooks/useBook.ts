import { useCallback, useEffect, useState } from "react";
import { useApi } from "./useApi";

export function useBook<T = any>(id: string | undefined) {
  const { apiFetch, token } = useApi();
  const [book, setBook] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(
    (opts?: { silent?: boolean }) => {
      if (!token || !id) return;
      if (!opts?.silent) setLoading(true);
      return apiFetch<{ book: T }>(`/api/books/${id}`)
        .then(({ book }) => {
          setBook(book);
          setError(null);
        })
        .catch((e: any) => {
          if (!opts?.silent) setError(e.message || "Помилка завантаження");
        })
        .finally(() => {
          if (!opts?.silent) setLoading(false);
        });
    },
    [token, id]
  );

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Silent background refresh when the author comes back to this tab --
  // covers "admin approved my republish/changes while I had this page open
  // in the background" without a fixed-interval poll (see CLAUDE.md's
  // useApi/manuscript-polling incident for why not to do that here).
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") refetch({ silent: true });
    }
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refetch]);

  return { book, setBook, loading, error, refetch };
}

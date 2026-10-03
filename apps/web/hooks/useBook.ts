import { useCallback, useEffect, useState } from "react";
import { useApi } from "./useApi";

export function useBook<T = any>(id: string | undefined, opts?: { light?: boolean }) {
  const { apiFetch, token } = useApi();
  const [book, setBook] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Dashboard overview (BookDashboard.tsx) doesn't render the cover editor
  // canvas -- light:true drops coverDesign/coverImageLibrary from the
  // response (book.ts's BOOK_SELECT_LIGHT), both of which otherwise grow
  // unbounded over a book's life and were shipped on every dashboard load
  // for no reason. Every other useBook(id) caller (cover editor, output-data
  // pages) still gets the full record as before.
  const light = opts?.light;

  const refetch = useCallback(
    (fetchOpts?: { silent?: boolean }) => {
      if (!token || !id) return;
      if (!fetchOpts?.silent) setLoading(true);
      return apiFetch<{ book: T }>(`/api/books/${id}${light ? "?fields=light" : ""}`)
        .then(({ book }) => {
          setBook(book);
          setError(null);
        })
        .catch((e: any) => {
          if (!fetchOpts?.silent) setError(e.message || "Помилка завантаження");
        })
        .finally(() => {
          if (!fetchOpts?.silent) setLoading(false);
        });
    },
    [token, id, light]
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

  // Every useBook(id) call is its OWN independent fetch/state -- there's no
  // shared cache between e.g. output-data/layout.tsx's instance (drives the
  // top nav pills' ✓/○ badges) and a leaf page's own instance (drives that
  // page's form). Live bug this fixed: saving "Інформація" updated the leaf
  // page's own `book` via its local setBook(updated) just fine (that page's
  // own heading turned green), but layout.tsx's separate `book` never heard
  // about it -- the top "Інформація" tab pill stayed stuck on its old ✓/○
  // state no matter how many times the author saved. "ulit:books-changed" is
  // the existing app-wide "a book mutated, anyone holding one should
  // refresh" signal (AuthorBooksSidebar/MyBooksList/useNotifications already
  // listen for it) -- every useBook(id) instance now does too, so a save
  // anywhere refreshes every other component's view of the same book without
  // them needing to share state directly.
  useEffect(() => {
    function onBooksChanged() {
      refetch({ silent: true });
    }
    window.addEventListener("ulit:books-changed", onBooksChanged);
    return () => window.removeEventListener("ulit:books-changed", onBooksChanged);
  }, [refetch]);

  return { book, setBook, loading, error, refetch };
}

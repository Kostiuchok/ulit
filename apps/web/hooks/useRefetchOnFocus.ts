import { useEffect } from "react";

// Same pattern already proven in useBook.ts: silently refetch whenever the
// tab comes back into view, instead of a fixed-interval poll (see CLAUDE.md's
// useApi/manuscript-polling incident for why not to do that here). Admin
// pages open in a browser session completely separate from the author's --
// there's no same-tab event bus that could ever reach them (that's what
// "ulit:books-changed" covers for the author's own two simultaneous views),
// so "did the tab regain focus" is the only cheap signal available for
// picking up changes an author made elsewhere in the meantime.
export function useRefetchOnFocus(refetch: () => void) {
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") refetch();
    }
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refetch]);
}

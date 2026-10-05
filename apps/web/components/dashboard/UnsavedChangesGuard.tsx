"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

interface Props {
  // There are edits on this page that leaving it would lose.
  active: boolean;
  // Omit where saving is not a "quick, harmless" step (the cover editor of a
  // PUBLISHED book: saving sends the cover to moderation and starts the
  // 90-day lock) -- the dialog then only offers "stay" / "leave".
  onSave?: () => void | Promise<unknown>;
  // Save is currently impossible (required field empty, validation error).
  saveDisabled?: boolean;
  // Read AFTER onSave settles: still true means the save did not go through
  // (validation or server error), so the author stays on the page.
  isStillUnsaved?: () => boolean;
}

// The browser Back button, as a destination.
const BACK = "__back__";

// Stops an author from silently losing unsaved edits (found live 2026-10-05:
// change the annotation, click the "Ціна" tab -- gone, no warning). One
// guard for the whole author cabinet; a page only says "I have unsaved
// edits" (FORMS-REFACTOR-PLAN.md, етап 4).
//
// The App Router has no "block this navigation" hook, so every way out is
// covered where it starts:
//   - a click on any in-app link (tabs, sidebar, "До дашборду книги"): a
//     capture-phase listener on the document sees it before Next's own Link
//     handler does;
//   - the browser Back button: while armed, one extra history entry for the
//     same page sits on top, so Back lands on this page again (a popstate we
//     can answer) instead of leaving it;
//   - closing or reloading the tab: the browser's own beforeunload prompt.
// Not covered: navigations fired from code by a plain button (router.push) --
// those call sites have to ask for themselves.
export function UnsavedChangesGuard({ active, onSave, saveDisabled, isStillUnsaved }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const activeRef = useRef(active);
  activeRef.current = active;
  // Set once the author has chosen to leave: from then on nothing here may
  // stand in the way of the navigation.
  const leavingRef = useRef(false);
  const sentinelPushedRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (leavingRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const onClick = (e: MouseEvent) => {
      if (!activeRef.current || leavingRef.current) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      // Another site: a real page unload, beforeunload already asks.
      if (url.origin !== window.location.origin) return;
      // Same page, different #anchor ("Перейти до першого") -- nothing is lost.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      setPending(url.pathname + url.search + url.hash);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [active]);

  // Back button. The extra entry copies the router's own history.state, so
  // to Next it is simply the same page again. Pushed at most once per mount:
  // if the edits get saved the entry just stays (one harmless extra Back).
  useEffect(() => {
    if (!active) return;
    const pushSentinel = () => window.history.pushState(window.history.state, "", window.location.href);
    if (!sentinelPushedRef.current) {
      sentinelPushedRef.current = true;
      pushSentinel();
    }
    const onPopState = () => {
      if (leavingRef.current || !activeRef.current) return;
      // Back just took us off the top entry -- put it back and ask.
      pushSentinel();
      setPending(BACK);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [active]);

  const leave = () => {
    const target = pending;
    setPending(null);
    if (!target) return;
    leavingRef.current = true;
    if (target === BACK) {
      // Past the extra entry and the page itself.
      window.history.go(-2);
      return;
    }
    const from = window.location.pathname + window.location.search;
    router.push(target);
    // Belt and braces: if the soft navigation has not moved the URL (it once
    // could not -- see CLAUDE.md журнал #39), load the page the plain way.
    window.setTimeout(() => {
      if (window.location.pathname + window.location.search === from) window.location.assign(target);
    }, 2500);
    // If this component outlives the navigation (shared layout), re-arm.
    window.setTimeout(() => {
      leavingRef.current = false;
    }, 5000);
  };

  const saveAndLeave = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave();
      // The page reports its new state through a re-render; give it one.
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (isStillUnsaved?.()) {
        setPending(null); // save didn't go through -- the page shows why
        return;
      }
      leave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={pending !== null} onOpenChange={(open) => !open && !saving && setPending(null)}>
      {/* Buttons are stacked, full width: three of them side by side did not
          fit the dialog (and dragged the text out of it too) on narrower
          screens -- a column cannot overflow at any width. */}
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
        <DialogTitle className="text-base font-semibold text-gray-900">Є незбережені зміни</DialogTitle>
        <DialogDescription className="min-w-0 break-words text-sm text-gray-600">
          Якщо перейти на іншу сторінку зараз, зміни на цій сторінці буде втрачено.
          {onSave && saveDisabled && " Зберегти поки не можна — заповніть обов'язкові поля, підсвічені помаранчевим."}
        </DialogDescription>
        <div className="flex min-w-0 flex-col gap-2">
          {onSave && (
            <Button type="button" className="w-full" onClick={saveAndLeave} disabled={saving || !!saveDisabled}>
              {saving ? "Збереження…" : "Зберегти й перейти"}
            </Button>
          )}
          <Button type="button" variant="outline" className="w-full" onClick={() => setPending(null)} disabled={saving}>
            Залишитись на сторінці
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full text-red-600 hover:text-red-700"
            onClick={leave}
            disabled={saving}
          >
            Вийти без збереження
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

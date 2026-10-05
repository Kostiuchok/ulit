"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";

interface Props {
  // There are edits on this page that leaving it would lose.
  active: boolean;
  // Omit where saving is not a "quick, harmless" step (the cover editor:
  // saving a published book's cover sends it to moderation and starts the
  // 90-day lock) -- the dialog then only offers "stay" / "leave".
  onSave?: () => void | Promise<unknown>;
  // Save is currently impossible (required field empty, validation error).
  saveDisabled?: boolean;
  // Read AFTER onSave settles: still true means the save did not go through
  // (validation or server error), so the author stays on the page.
  isStillUnsaved?: () => boolean;
}

// Stops an author from silently losing unsaved edits (found live 2026-10-05:
// change the annotation, click the "Ціна" tab -- gone, no warning).
//
// The App Router has no "block this navigation" hook, so in-app navigation
// is caught where it starts: a capture-phase click listener on the document
// sees every <a> click (tabs, sidebar, "До дашборду книги") before Next's
// own Link handler does. Closing or reloading the tab is covered by the
// browser's own beforeunload prompt. NOT covered: the browser Back button
// and navigations fired from code (router.push from a plain button).
export function UnsavedChangesGuard({ active, onSave, saveDisabled, isStillUnsaved }: Props) {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const onClick = (e: MouseEvent) => {
      if (!activeRef.current) return;
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
      setPendingHref(url.pathname + url.search + url.hash);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [active]);

  const leave = () => {
    const href = pendingHref;
    setPendingHref(null);
    if (href) router.push(href);
  };

  const saveAndLeave = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave();
      // The page reports its new state through a re-render; give it one.
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (isStillUnsaved?.()) {
        setPendingHref(null); // save didn't go through -- the page shows why
        return;
      }
      leave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={pendingHref !== null} onOpenChange={(open) => !open && !saving && setPendingHref(null)}>
      <DialogContent className="max-w-md">
        <DialogTitle className="text-base font-semibold text-gray-900">Є незбережені зміни</DialogTitle>
        <DialogDescription className="text-sm text-gray-600">
          Якщо перейти на іншу сторінку зараз, зміни на цій сторінці буде втрачено.
          {onSave && saveDisabled && " Зберегти поки не можна — заповніть обов'язкові поля, підсвічені помаранчевим."}
        </DialogDescription>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => setPendingHref(null)} disabled={saving}>
            Залишитись
          </Button>
          <Button type="button" variant="outline" onClick={leave} disabled={saving} className="text-red-600 hover:text-red-700">
            Вийти без збереження
          </Button>
          {onSave && (
            <Button type="button" onClick={saveAndLeave} disabled={saving || !!saveDisabled}>
              {saving ? "Збереження…" : "Зберегти й перейти"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

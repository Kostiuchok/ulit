"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowUp, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SaveActionButton } from "@/components/ui/SaveActionButton";
import { UnsavedChangesGuard } from "@/components/dashboard/UnsavedChangesGuard";
import { cn } from "@/lib/utils";

// WF-SPEC "Спільне для 03, 05-07": one shared sticky save bar at the bottom
// of every output-data leaf page, instead of each page owning its own
// inline Save button (that's what 03/05/06 did until now). The leaf page
// never renders its own button -- it registers its current save state here
// via useOutputDataSaveBar(), and OutputDataLayout (the only consumer that
// actually renders the bar) reads it. Confirmed with Анатолій (2026-10-05):
// migrate "Ціна" (already shipped, Phase 1) into this too -- only the
// button's LOCATION moves, none of its save/validation logic.
export interface OutputDataSaveBarState {
  dirty: boolean;
  saving?: boolean;
  savedAt?: Date | null;
  errorCount?: number;
  // Anchor (e.g. "#blk-copyright") "Перейти до першого"/error pill scrolls
  // to -- plain hash scroll, no router involved, so it works mid-form.
  firstErrorHref?: string;
  onSave?: () => void | Promise<unknown>;
  // The page holds form edits that navigating away would lose -- arms the
  // "Є незбережені зміни" leave dialog (UnsavedChangesGuard). Separate from
  // `dirty` on purpose: "Огляд" uses dirty for "there are changes to send to
  // moderation", which are already saved and must not block navigation.
  unsaved?: boolean;
  saveLabel?: string;
  savingLabel?: string;
  disabledTitle?: string;
  // Required-but-empty fields (amber, not a red validation error) also
  // block Save -- distinct from errorCount, which drives the red pill.
  saveDisabled?: boolean;
  // Full override for the generic "Є незбережені зміни"/"Збережено ✓"
  // status text -- "Ціна" (05) needs its own richer message ("...у N
  // блоках · ULIT: одразу після збереження" + a tooltip), which the generic
  // text can't express. undefined keeps the default; a page can pass
  // `null` to render no status text at all.
  statusNote?: React.ReactNode;
  // Names what `statusNote` currently shows. The bar re-renders when this
  // string changes (a React node itself cannot be compared) -- so a page
  // that passes a statusNote whose content varies MUST pass a key that
  // varies with it.
  statusKey?: string;
}

// The bar's state lives in a small store OUTSIDE React state
// (FORMS-REFACTOR-PLAN.md, етап 4 / правило 6: shared state travels by
// subscription, never by "set state after every render").
//
// How it got here: the first version kept this state in the provider's
// useState and had every leaf page call setState after each of its renders.
// One unstable context value was then enough for page and provider to
// re-render each other forever; the loop starved React transitions and
// in-app navigation silently stopped working (CLAUDE.md журнал #39).
//
// Now a page hands over its latest state (so callbacks and status nodes are
// always fresh) but the bar is only told to re-render when something it
// actually SHOWS has changed -- compared by `signature`. A page render that
// changes nothing visible notifies nobody, so there is nothing to loop on,
// whatever the surrounding components do.
interface SaveBarStore {
  get: () => OutputDataSaveBarState | null;
  version: () => number;
  set: (state: OutputDataSaveBarState | null) => void;
  subscribe: (listener: () => void) => () => void;
}

function signature(s: OutputDataSaveBarState | null): string {
  if (!s) return "";
  return JSON.stringify([
    s.dirty,
    !!s.saving,
    s.savedAt ? s.savedAt.getTime() : null,
    s.errorCount ?? 0,
    s.firstErrorHref ?? "",
    !!s.unsaved,
    s.saveLabel ?? "",
    s.savingLabel ?? "",
    s.disabledTitle ?? "",
    !!s.saveDisabled,
    !!s.onSave,
    // A status node cannot be compared; the page names what it shows.
    s.statusNote === undefined ? "default" : s.statusNote === null ? "none" : `node:${s.statusKey ?? ""}`,
  ]);
}

function createSaveBarStore(): SaveBarStore {
  let state: OutputDataSaveBarState | null = null;
  let sig = "";
  let version = 0;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    version: () => version,
    set(next) {
      state = next;
      const nextSig = signature(next);
      if (nextSig === sig) return;
      sig = nextSig;
      version += 1;
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const StoreCtx = createContext<SaveBarStore | null>(null);

export function OutputDataSaveBarProvider({ children }: { children: React.ReactNode }) {
  // One store per layout mount; the context value never changes.
  const store = useMemo(createSaveBarStore, []);
  return <StoreCtx.Provider value={store}>{children}</StoreCtx.Provider>;
}

function useSaveBarStore(): SaveBarStore {
  const store = useContext(StoreCtx);
  if (!store) throw new Error("useOutputDataSaveBar must be used inside OutputDataSaveBarProvider");
  return store;
}

// A leaf page calls this on every render with its current save state.
export function useOutputDataSaveBar(input: OutputDataSaveBarState) {
  const store = useSaveBarStore();

  // Hand over the latest state after each render -- a plain assignment into
  // the store, which notifies the bar only if its signature changed.
  useEffect(() => {
    store.set(input);
  });
  // The bar empties when the page goes away (and only then).
  useEffect(() => () => store.set(null), [store]);
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
}

// Rendered once, by OutputDataLayout -- reads StateCtx so it (and only it)
// re-renders when a leaf page's registered state changes.
export function OutputDataSaveBar({ bookId }: { bookId: string }) {
  const store = useSaveBarStore();
  // Re-renders when the store's version moves, i.e. when a page reported a
  // state that looks different on the bar.
  useSyncExternalStore(store.subscribe, store.version, store.version);
  const state = store.get();
  const hasErrors = !!state?.errorCount && state.errorCount > 0;

  return (
    <>
    <UnsavedChangesGuard
      active={!!state?.unsaved && !state.saving}
      onSave={state?.onSave}
      saveDisabled={hasErrors || !!state?.saveDisabled}
      isStillUnsaved={() => !!store.get()?.unsaved}
    />
    <div className="sticky bottom-0 z-20 -mx-8 border-t border-gray-200 bg-white/95 px-8 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.04)] backdrop-blur">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" className="h-auto gap-1.5 px-0 text-sm text-gray-600 hover:bg-transparent hover:text-black">
          <Link href={`/dashboard/books/${bookId}`}>← До дашборду книги</Link>
        </Button>

        {state && (state.dirty || state.saving || state.savedAt || state.statusNote !== undefined) && (
          <div className="ml-auto flex items-center gap-3">
            {state.statusNote !== undefined ? (
              state.statusNote
            ) : (
              <>
                {state.dirty && !state.saving && (
                  <span className="inline-flex items-center gap-2 text-sm text-amber-700">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    Є незбережені зміни
                    {hasErrors && (
                      <>
                        <span className="text-gray-300">·</span>
                        <a
                          href={state.firstErrorHref}
                          className="inline-flex items-center gap-1 font-medium text-red-600 underline decoration-red-300 underline-offset-2"
                        >
                          <span className="h-2 w-2 rounded-full bg-red-500" />
                          {state.errorCount} помилка
                        </a>
                      </>
                    )}
                  </span>
                )}
                {!state.dirty && !state.saving && state.savedAt && (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700">
                    <Check size={15} />
                    Збережено ✓ · {fmtTime(state.savedAt)}
                  </span>
                )}
                {state.dirty && state.firstErrorHref && (
                  <a
                    href={state.firstErrorHref}
                    className="inline-flex h-7 items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
                  >
                    <ArrowUp size={14} />
                    Перейти до першого
                  </a>
                )}
              </>
            )}
            {state.onSave && (
              <SaveActionButton
                type="button"
                onClick={state.onSave}
                state={state.saving ? "saving" : state.dirty ? "idle" : "saved"}
                idleLabel={state.saveLabel ?? "Зберегти зміни"}
                savingLabel={state.savingLabel}
                disabled={!state.dirty || hasErrors || !!state.saveDisabled}
                title={hasErrors || state.saveDisabled ? state.disabledTitle : undefined}
              >
                {hasErrors && (
                  <span
                    className="ml-0.5 inline-flex items-center gap-0.5 rounded-full bg-red-500 px-1.5 text-[0.6875rem] font-semibold text-white"
                    title={state.disabledTitle ?? "Помилка — виправте перед збереженням"}
                  >
                    {state.errorCount}
                  </span>
                )}
              </SaveActionButton>
            )}
          </div>
        )}
      </div>
    </div>
    </>
  );
}

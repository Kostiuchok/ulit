"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
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
}

const Ctx = createContext<{ setState: (s: OutputDataSaveBarState | null) => void } | null>(null);
const StateCtx = createContext<OutputDataSaveBarState | null>(null);

export function OutputDataSaveBarProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<OutputDataSaveBarState | null>(null);
  // MUST be a stable object. A fresh `{ setState }` on every provider render
  // re-rendered every Ctx consumer (the leaf page), whose effect then called
  // setState again with a new object -> provider re-renders -> ... an
  // endless urgent render loop. It starved React transitions, so in-app
  // navigation (tabs, sidebar links, router.push) silently never completed
  // -- reported live as "tabs don't switch at all".
  const ctxValue = useMemo(() => ({ setState }), []);
  return (
    <Ctx.Provider value={ctxValue}>
      <StateCtx.Provider value={state}>{children}</StateCtx.Provider>
    </Ctx.Provider>
  );
}

// Split into two contexts on purpose: a leaf page only needs the stable
// `setState` setter (from Ctx) to REGISTER its own state -- it must never
// re-render just because some OTHER page's bar state changed. Only
// OutputDataSaveBar itself (below) reads StateCtx.
function useSetSaveBarState() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useOutputDataSaveBar must be used inside OutputDataSaveBarProvider");
  return ctx.setState;
}

// Leaf pages call this every render with their current save state. Runs
// after EVERY render (no dependency array) -- safe here specifically
// because this hook only consumes the stable `setState` setter (via Ctx),
// never StateCtx's value, so calling setState can't make THIS component
// re-render; it only re-renders OutputDataSaveBar (a different component
// elsewhere in the tree), so there's no feedback loop. This is what lets a
// page pass a live `statusNote` (e.g. "Ціна"'s "...у N блоках" message)
// that always reflects the latest render, not a stale one gated behind a
// primitive dependency list.
export function useOutputDataSaveBar(input: OutputDataSaveBarState) {
  const setState = useSetSaveBarState();

  useEffect(() => {
    setState(input);
    return () => setState(null);
  });
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
}

// Rendered once, by OutputDataLayout -- reads StateCtx so it (and only it)
// re-renders when a leaf page's registered state changes.
export function OutputDataSaveBar({ bookId }: { bookId: string }) {
  const state = useContext(StateCtx);
  const hasErrors = !!state?.errorCount && state.errorCount > 0;
  const stateRef = useRef(state);
  stateRef.current = state;

  return (
    <>
    <UnsavedChangesGuard
      active={!!state?.unsaved && !state.saving}
      onSave={state?.onSave}
      saveDisabled={hasErrors || !!state?.saveDisabled}
      isStillUnsaved={() => !!stateRef.current?.unsaved}
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

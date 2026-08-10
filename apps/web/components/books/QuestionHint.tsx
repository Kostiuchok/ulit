"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";

interface Props {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

// Rough max height of the popup box — used only to decide whether it should
// open upward instead of downward near the bottom of the viewport.
const ESTIMATED_POPUP_HEIGHT = 160;

// Small "?" marker for explanatory copy — shown on hover, stays open on click
// (mirrors the always-visible ISBN tooltip in PublicationTimeline, but for
// content that's too long to show inline by default).
export function QuestionHint({ title, children, className }: Props) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const visible = open || hovered;

  useLayoutEffect(() => {
    if (!visible || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setOpenUp(rect.bottom + ESTIMATED_POPUP_HEIGHT > window.innerHeight);
  }, [visible]);

  return (
    <span
      ref={anchorRef}
      className={cn("relative inline-flex items-center", className)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={title}
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-gray-400 text-[0.625rem] font-bold leading-none text-gray-500 hover:border-gray-900 hover:text-gray-900"
      >
        ?
      </button>
      {visible && (
        <span
          className={cn(
            "absolute left-0 z-20 w-80 rounded-md bg-white px-3 py-2 text-[0.8125rem] leading-snug text-black shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]",
            openUp ? "bottom-[calc(100%+6px)]" : "top-[calc(100%+6px)]"
          )}
        >
          {children}
        </span>
      )}
    </span>
  );
}

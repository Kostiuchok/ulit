"use client";

import { useState } from "react";
import { cn } from "../../lib/utils";

interface Props {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

// Small "?" marker for explanatory copy — shown on hover, stays open on click
// (mirrors the always-visible ISBN tooltip in PublicationTimeline, but for
// content that's too long to show inline by default).
export function QuestionHint({ title, children, className }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <span className={cn("group relative inline-flex items-center", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={title}
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-gray-400 text-[0.625rem] font-bold leading-none text-gray-500 hover:border-gray-900 hover:text-gray-900"
      >
        ?
      </button>
      <span
        className={cn(
          "absolute left-0 top-[calc(100%+6px)] z-20 w-64 rounded-md bg-white px-3 py-2 text-[0.8125rem] leading-snug text-black shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]",
          open ? "block" : "hidden group-hover:block"
        )}
      >
        {children}
      </span>
    </span>
  );
}

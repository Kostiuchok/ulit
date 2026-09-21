"use client";

import { useRef, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Props {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

// Small "?" marker for explanatory copy -- shown on hover, stays open on
// click (mirrors the always-visible ISBN tooltip in PublicationTimeline,
// but for content that's too long to show inline by default).
//
// Built on shadcn's Tooltip (Radix) instead of a hand-rolled hover
// span + getBoundingClientRect() viewport check: Radix's own Popper
// positioning already flips the popup above/below near a viewport edge
// (avoidCollisions, on by default), and its "hoverable content" handling
// (see @radix-ui/react-tooltip's isPointerInTransitRef) keeps the popup
// open while the pointer moves from the "?" trigger onto the popup itself
// -- something the old version got for free only because the popup was a
// plain DOM descendant of the same hover-tracked <span>; Radix portals its
// content to document.body, so that trick doesn't carry over on its own.
// `open` stays controlled here only so a click can pin the popup open past
// a mouseleave -- pinnedRef.current gates which hover-driven close
// requests actually get honored.
export function QuestionHint({ title, children, className }: Props) {
  const [open, setOpen] = useState(false);
  const pinnedRef = useRef(false);

  function handleOpenChange(next: boolean) {
    if (!next && pinnedRef.current) return;
    setOpen(next);
  }

  function handleTriggerClick() {
    pinnedRef.current = !pinnedRef.current;
    setOpen(pinnedRef.current);
  }

  return (
    <Tooltip open={open} onOpenChange={handleOpenChange} delayDuration={0}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleTriggerClick}
          title={title}
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-gray-400 text-[0.625rem] font-bold leading-none text-gray-500 hover:border-gray-900 hover:text-gray-900",
            className
          )}
        >
          ?
        </button>
      </TooltipTrigger>
      <TooltipContent className="w-80 border bg-white px-3 py-2 text-[0.8125rem] leading-snug text-black shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

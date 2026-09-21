"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface Props {
  title: ReactNode;
  description?: ReactNode;
  // Most blocks start expanded. Explicit opt-in to closed-by-default is for
  // blocks most authors don't need to touch (e.g. "Авторське право /
  // попередня публікація" -- no usage stats yet on how many authors
  // actually fill it in, so it starts collapsed until there's data to
  // justify defaulting it open).
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}

export function CollapsibleSection({ title, description, defaultOpen = true, className, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={className}>
      <CollapsibleTrigger className="flex w-full items-start justify-between gap-2 text-left">
        <div className="space-y-0.5">
          {typeof title === "string" ? <h3 className="text-base font-semibold text-gray-900">{title}</h3> : title}
          {description && <p className="text-xs text-gray-500">{description}</p>}
        </div>
        <ChevronDown
          className={cn("mt-0.5 h-4 w-4 shrink-0 text-gray-400 transition-transform", open && "rotate-180")}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

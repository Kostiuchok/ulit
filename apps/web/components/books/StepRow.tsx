"use client";

import Link from "next/link";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

export function StepRow({
  num,
  done,
  label,
  hint,
  action,
}: {
  num: number;
  done: boolean;
  label: string;
  hint?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-0">
      <div
        className={cn(
          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          done
            ? "bg-green-100 text-green-700"
            : "bg-gray-100 text-gray-400"
        )}
      >
        {done ? "✓" : num}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium", done ? "text-gray-700" : "text-gray-500")}>
          {label}
        </p>
        {hint && !done && (
          <p className="text-xs text-gray-400 mt-0.5">{hint}</p>
        )}
      </div>
      {!done && action && (
        <Link href={action.href}>
          <Button variant="outline" size="sm" className="shrink-0">
            {action.label} →
          </Button>
        </Link>
      )}
    </div>
  );
}

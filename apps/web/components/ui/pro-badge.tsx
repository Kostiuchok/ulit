import { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

// Marks a requirement/feature that needs a professional designer's
// involvement (print-grade illustration prep, CMYK conversion, etc.) rather
// than something the platform can validate or do for the author automatically.
export function ProBadge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-700 align-middle",
        className
      )}
      {...props}
    >
      PRO
    </span>
  );
}

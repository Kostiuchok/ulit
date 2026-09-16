"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  // Radix's Root renders its hidden native `<input>` (for form participation)
  // as a plain SIBLING of the visible trigger button, position:absolute with
  // no top/left/right/bottom set -- that falls back to the element's static-
  // flow position, computed against the nearest POSITIONED ancestor, or the
  // whole document if none exists. A page with zero `position:relative`
  // (etc.) ancestors anywhere up to <html> (confirmed live on
  // dashboard/books/.../output-data) let that hidden input's containing
  // block become the document itself -- it landed far down the real page,
  // inflating documentElement.scrollHeight by ~800px of blank space below
  // the actual content, with its own outer scrollbar. This span guarantees
  // both the button and the hidden input always share a local, correctly-
  // scoped positioned ancestor, regardless of what (if anything) wraps this
  // component at any given call site.
  <span className="relative inline-flex">
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        "grid place-content-center peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className={cn("grid place-content-center text-current")}
      >
        <Check className="h-4 w-4" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  </span>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }

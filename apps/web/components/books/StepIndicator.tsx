"use client";

import { cn } from "@/lib/utils";

interface Props {
  steps: { label: string }[];
  current: number;
  onStepClick?: (index: number) => void;
}

export function StepIndicator({ steps, current, onStepClick }: Props) {
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between">
        {steps.map((s, i) => (
          <div key={i} className="flex flex-1 items-center">
            <button
              type="button"
              onClick={() => onStepClick?.(i)}
              disabled={!onStepClick}
              className="flex flex-col items-center disabled:cursor-default"
            >
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
                  i < current
                    ? "bg-primary text-primary-foreground"
                    : i === current
                    ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                    : "bg-gray-200 text-gray-400"
                )}
              >
                {i < current ? "✓" : i + 1}
              </div>
              <span className={cn("mt-1 text-xs", i === current ? "text-gray-900 font-medium" : "text-gray-400")}>
                {s.label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <div className={cn("flex-1 h-0.5 mx-1 mb-5", i < current ? "bg-primary" : "bg-gray-200")} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

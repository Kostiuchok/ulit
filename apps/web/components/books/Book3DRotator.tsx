"use client";

import { useState } from "react";

interface Props {
  coverUrl: string;
  backCoverUrl?: string | null;
  title?: string;
  pageCount?: number;
  onOpen?: () => void;
}

const W = 260; // front/back face width, px (on-screen preview scale, not print DPI)
const H = 368; // ~A5-ish 148:210 ratio

// Same idea as the spine-width formula already used in CoverDesignerCanvas.tsx
// (T-1914): pageCount x 0.1mm, converted to this component's own px scale.
// Not imported from the cover editor — kept local so this view stays
// decoupled from the cover-editing feature.
function spineDepth(pageCount?: number) {
  const mmDepth = Math.max(4, (pageCount ?? 100) * 0.1);
  return Math.round(mmDepth * 2.2); // mm -> px at this component's own scale
}

export function Book3DRotator({ coverUrl, backCoverUrl, title, pageCount, onOpen }: Props) {
  const [angle, setAngle] = useState(0);
  const depth = spineDepth(pageCount);

  return (
    <div className="flex flex-col items-center gap-6 py-10">
      <div style={{ perspective: 1400 }}>
        <div
          role={onOpen ? "button" : undefined}
          tabIndex={onOpen ? 0 : undefined}
          onClick={onOpen}
          onKeyDown={(e) => onOpen && (e.key === "Enter" || e.key === " ") && onOpen()}
          aria-label={onOpen ? "Відкрити книгу" : undefined}
          className={onOpen ? "relative cursor-pointer" : "relative"}
          style={{
            width: W,
            height: H,
            transformStyle: "preserve-3d",
            transform: `rotateY(${angle}deg)`,
            transition: "transform 0.15s ease-out",
          }}
        >
          {/* Front cover */}
          <div
            className="absolute left-0 top-0 overflow-hidden rounded-sm shadow-md"
            style={{ width: W, height: H, transform: `translateZ(${depth / 2}px)` }}
          >
            <img src={coverUrl} alt="" className="h-full w-full object-cover" />
          </div>

          {/* Spine */}
          <div
            className="absolute left-0 top-0 flex items-center justify-center overflow-hidden bg-gray-900"
            style={{
              width: depth,
              height: H,
              left: (W - depth) / 2,
              transform: `rotateY(-90deg) translateZ(${W / 2}px)`,
            }}
          >
            {title && (
              <span
                className="whitespace-nowrap text-[0.6875rem] font-medium text-white/80"
                style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
              >
                {title}
              </span>
            )}
          </div>

          {/* Back cover */}
          <div
            className="absolute left-0 top-0 overflow-hidden rounded-sm shadow-md"
            style={{ width: W, height: H, transform: `rotateY(180deg) translateZ(${depth / 2}px)` }}
          >
            <img src={backCoverUrl ?? coverUrl} alt="" className="h-full w-full object-cover" />
          </div>
        </div>

        {/* Soft "resting on a table" shadow */}
        <div
          className="mx-auto mt-2 rounded-full blur-md"
          style={{ width: W * 0.85, height: 18, background: "rgba(0,0,0,0.25)" }}
        />
      </div>

      <div className="flex w-full max-w-xs items-center gap-3 px-6">
        <span className="text-gray-300">📱</span>
        <input
          type="range"
          min={-180}
          max={180}
          value={angle}
          onChange={(e) => setAngle(Number(e.target.value))}
          className="flex-1 accent-gray-900"
          aria-label="Обертання книги"
        />
        <span className="text-gray-400">📖</span>
      </div>
    </div>
  );
}

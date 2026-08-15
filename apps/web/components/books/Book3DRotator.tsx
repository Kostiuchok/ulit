"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

interface Props {
  coverUrl: string;
  backCoverUrl?: string | null;
  spineUrl?: string | null;
  title?: string;
  pageCount?: number;
  onOpen?: () => void;
}

const ASPECT = 148 / 210; // A5 width/height ratio
const DRAG_SENSITIVITY = 0.6; // deg of rotation per px dragged

// Same idea as the spine-width formula already used in CoverDesignerCanvas.tsx
// (T-1914): pageCount x 0.1mm, scaled proportionally to however big the book
// is currently rendered (height corresponds to 210mm). Not imported from the
// cover editor — kept local so this view stays decoupled from cover editing.
function spineDepth(pageCount: number | undefined, renderedHeight: number) {
  const mmDepth = Math.max(4, (pageCount ?? 100) * 0.1);
  return Math.round(mmDepth * (renderedHeight / 210));
}

export function Book3DRotator({ coverUrl, backCoverUrl, spineUrl, title, pageCount, onOpen }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [angle, setAngle] = useState(0);
  const [bookH, setBookH] = useState(368);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startAngle: 0, moved: false });

  // Size the book off the actual available canvas height instead of a fixed
  // constant — "canvas should fill the screen, book was looking too small."
  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const measure = () => setBookH(Math.max(220, el.clientHeight * 0.82));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = bookH;
  const W = Math.round(H * ASPECT);
  const depth = spineDepth(pageCount, H);

  // Click-and-drag rotation (in addition to the slider below) — pointer
  // capture keeps the drag going even if the cursor leaves the book while
  // the button is held. `moved` distinguishes a drag from a plain click so
  // onOpen (when present) doesn't fire after a drag.
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      dragRef.current = { startX: e.clientX, startAngle: angle, moved: false };
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [angle]
  );

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    if (e.buttons === 0) return;
    const dx = e.clientX - dragRef.current.startX;
    if (Math.abs(dx) > 3) dragRef.current.moved = true;
    setAngle(Math.min(180, Math.max(-180, dragRef.current.startAngle + dx * DRAG_SENSITIVITY)));
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      setDragging(false);
      e.currentTarget.releasePointerCapture(e.pointerId);
      if (!dragRef.current.moved) onOpen?.();
    },
    [onOpen]
  );

  return (
    <div className="flex h-[80vh] flex-col items-center gap-4 py-4">
      <div ref={canvasRef} className="flex min-h-0 w-full flex-1 flex-col items-center justify-center">
        <div style={{ perspective: 1400 }}>
          <div
            role={onOpen ? "button" : undefined}
            tabIndex={onOpen ? 0 : undefined}
            onKeyDown={(e) => onOpen && (e.key === "Enter" || e.key === " ") && onOpen()}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            aria-label="Перетягніть, щоб обертати книгу"
            className="relative select-none touch-none cursor-grab active:cursor-grabbing"
            style={{
              width: W,
              height: H,
              transformStyle: "preserve-3d",
              transform: `rotateY(${angle}deg)`,
              transition: dragging ? "none" : "transform 0.15s ease-out",
            }}
          >
            {/* Front cover */}
            <div
              className="absolute left-0 top-0 overflow-hidden rounded-sm shadow-md"
              style={{ width: W, height: H, transform: `translateZ(${depth / 2}px)` }}
            >
              <img src={coverUrl} alt="" className="h-full w-full object-cover" draggable={false} />
            </div>

            {/* Spine — real exported spine art/title if the author saved one
                (softcover: cover art continues onto it; hardcover: usually
                just the title), otherwise a plain placeholder fallback. */}
            <div
              className="absolute left-0 top-0 flex items-center justify-center overflow-hidden bg-gray-900"
              style={{
                width: depth,
                height: H,
                left: (W - depth) / 2,
                transform: `rotateY(-90deg) translateZ(${W / 2}px)`,
              }}
            >
              {spineUrl ? (
                <img src={spineUrl} alt="" className="h-full w-full object-cover" draggable={false} />
              ) : (
                title && (
                  <span
                    className="whitespace-nowrap text-[0.6875rem] font-medium text-white/80"
                    style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                  >
                    {title}
                  </span>
                )
              )}
            </div>

            {/* Page block — the fore-edge opposite the spine, i.e. the block
                of paper you'd see looking at a closed book from the side.
                Purely decorative (no real per-page render), just a stacked-
                paper texture so the box doesn't read as hollow/empty. */}
            <div
              className="absolute left-0 top-0 overflow-hidden"
              style={{
                width: depth,
                height: H,
                left: (W - depth) / 2,
                transform: `rotateY(90deg) translateZ(${W / 2}px)`,
                background:
                  "repeating-linear-gradient(to bottom, #f7f4ec 0px, #f7f4ec 2px, #e5ded0 2px, #e5ded0 3px)",
                boxShadow: "inset 3px 0 6px rgba(0,0,0,0.12), inset -3px 0 6px rgba(0,0,0,0.12)",
              }}
            />

            {/* Back cover */}
            <div
              className="absolute left-0 top-0 overflow-hidden rounded-sm shadow-md"
              style={{ width: W, height: H, transform: `rotateY(180deg) translateZ(${depth / 2}px)` }}
            >
              <img src={backCoverUrl ?? coverUrl} alt="" className="h-full w-full object-cover" draggable={false} />
            </div>
          </div>

          {/* Soft "resting on a table" shadow */}
          <div
            className="mx-auto mt-3 rounded-full blur-md"
            style={{ width: W * 0.85, height: 18, background: "rgba(0,0,0,0.25)" }}
          />
        </div>
      </div>

      <div className="flex w-full max-w-xs shrink-0 items-center gap-3 px-6">
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

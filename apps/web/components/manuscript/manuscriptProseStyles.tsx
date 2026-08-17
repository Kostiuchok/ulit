import { MANUSCRIPT_PROSE_CSS } from "shared-types";

// Thin wrapper around the shared CSS string (packages/shared-types/src/manuscript/proseStyles.ts)
// — used by both the live TipTap editor (ManuscriptEditor.tsx) and the
// read-only paginated preview (ManuscriptPagePreview.tsx), and the SAME
// string is embedded server-side by the print-PDF render (T-2057). One
// source of truth across all three, so the print PDF can never visually
// drift from what the author actually built.
export function ManuscriptProseStyles() {
  return <style jsx global>{MANUSCRIPT_PROSE_CSS}</style>;
}

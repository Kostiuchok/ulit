import { computeCoverLayout, type CoverFormat } from "./CoverDesignerCanvas";

interface Props {
  coverUrl?: string | null;
  backCoverUrl?: string | null;
  spineUrl?: string | null;
  format: Extract<CoverFormat, "softcover" | "hardcover">;
  pageCount?: number | null;
  trimMm: { widthMm: number; heightMm: number };
  label: string;
}

// Flat, non-interactive preview of the full print wrap (back + spine +
// front, unfolded) with dashed fold-line guides -- same geometry
// (computeCoverLayout, exported from CoverDesignerCanvas) the live editor
// itself uses to place its own pink spine guides, just rendered as plain
// percentage-positioned <img>s/divs instead of inside the Fabric.js canvas,
// since this is a read-only "what actually goes to the moderator" review,
// not another editing surface. Percentages (not px) because
// computeCoverLayout's own units are internal to the editor's canvas scale
// -- only the RATIOS between totalW/totalH and each panel matter here.
export function CoverPrintSpread({ coverUrl, backCoverUrl, spineUrl, format, pageCount, trimMm, label }: Props) {
  const layout = computeCoverLayout(format, pageCount, trimMm);
  const pct = (v: number, total: number) => `${(v / total) * 100}%`;

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-gray-600">{label}</p>
      <div
        className="relative w-full overflow-hidden rounded-sm border border-gray-300 bg-gray-100"
        style={{ aspectRatio: `${layout.totalW} / ${layout.totalH}` }}
      >
        {layout.back && (
          <div
            className="absolute inset-y-0 overflow-hidden bg-gray-200"
            style={{ left: pct(layout.back.x, layout.totalW), width: pct(layout.back.w, layout.totalW) }}
          >
            {backCoverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={backCoverUrl} alt="" className="h-full w-full object-cover" />
            )}
          </div>
        )}
        {layout.spine && (
          <div
            className="absolute inset-y-0 overflow-hidden bg-gray-300"
            style={{ left: pct(layout.spine.x, layout.totalW), width: pct(layout.spine.w, layout.totalW) }}
          >
            {spineUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={spineUrl} alt="" className="h-full w-full object-cover" />
            )}
          </div>
        )}
        <div
          className="absolute inset-y-0 overflow-hidden bg-gray-200"
          style={{ left: pct(layout.front.x, layout.totalW), width: pct(layout.front.w, layout.totalW) }}
        >
          {coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        {/* Non-printing fold-line guides -- same border-dashed treatment
            CoverDesignerCanvas's own live spine guides use (pink there,
            since it's overlaid on an editable canvas; neutral gray here,
            since this is a static review, not an editing affordance). */}
        {layout.spine && (
          <>
            <div
              className="pointer-events-none absolute inset-y-0 border-l-2 border-dashed border-gray-500"
              style={{ left: pct(layout.spine.x, layout.totalW) }}
            />
            <div
              className="pointer-events-none absolute inset-y-0 border-l-2 border-dashed border-gray-500"
              style={{ left: pct(layout.spine.x + layout.spine.w, layout.totalW) }}
            />
          </>
        )}
      </div>
    </div>
  );
}

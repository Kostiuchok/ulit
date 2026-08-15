interface Props {
  coverUrl?: string | null;
  className?: string;
  // True for the back-cover slide: a physical book's back is the front
  // mirrored, so the spine/page-block lighting must mirror too, or a
  // side-by-side front/back pair reads as lit from two different angles.
  mirror?: boolean;
}

// Page-edge/spine sheen — matches Ridero's printed-book widget exactly
// (MainWidgetLibraryNext_cover__*): a left-to-right gradient that darkens
// near the left edge (spine shadow) and adds a faint highlight near the
// right edge (page-block curve), layered over the flat cover image.
const EDGE_SHEEN =
  "linear-gradient(90deg, hsla(0, 0%, 100%, .2), rgba(0, 0, 0, .25) 3.44%, hsla(0, 0%, 100%, .2) 6.21%, hsla(0, 0%, 58%, .15) 11.09%, hsla(0, 0%, 100%, 0) 66.98%, hsla(0, 0%, 89%, .15) 96.15%, hsla(0, 0%, 100%, .15))";

export function PrintedCoverFrame({ coverUrl, className, mirror }: Props) {
  return (
    <div
      className={`relative aspect-[242/343] w-full overflow-hidden rounded-[3px] shadow-[0_1px_2px_rgba(0,0,0,0.15),0_16px_28px_-10px_rgba(0,0,0,0.4)] ${className ?? ""}`}
    >
      {coverUrl ? (
        <img src={coverUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gray-100 text-4xl text-gray-300">📖</div>
      )}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: EDGE_SHEEN, transform: mirror ? "scaleX(-1)" : undefined }}
      />
    </div>
  );
}

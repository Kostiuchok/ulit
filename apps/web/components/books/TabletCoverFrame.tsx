interface Props {
  coverUrl?: string | null;
  className?: string;
}

export function TabletCoverFrame({ coverUrl, className }: Props) {
  return (
    <div className={`relative aspect-[232/341] w-full ${className ?? ""}`}>
      <div className="absolute inset-[6%_4%_8%_4%] overflow-hidden rounded-[6px] bg-gray-50">
        {coverUrl ? (
          // object-contain, not object-cover -- the "screen" cutout here is a
          // fixed shape (tablets have one physical shape), but the cover PNG
          // is exported at the book's own real trim ratio (shared-types
          // resolveBookPrintFormat -- pocket ~0.605 to large ~0.759), which
          // essentially never matches. object-cover was cropping real cover
          // content (title/author text near the edges, worst on formats
          // farthest from the tablet's own ratio) to force-fill the mismatched
          // box; object-contain shows the whole cover, letterboxed if needed.
          <img src={coverUrl} alt="" className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl text-gray-300">📖</div>
        )}
      </div>
      <img
        src="/figma/frame-for-book-cover.svg"
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
    </div>
  );
}

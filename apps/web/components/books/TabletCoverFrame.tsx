interface Props {
  coverUrl?: string | null;
  className?: string;
}

export function TabletCoverFrame({ coverUrl, className }: Props) {
  return (
    <div className={`relative aspect-[232/341] w-full ${className ?? ""}`}>
      <div className="absolute inset-[6%_4%_8%_4%] overflow-hidden rounded-[6px] bg-gray-50">
        {coverUrl ? (
          <img src={coverUrl} alt="" className="h-full w-full object-cover" />
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

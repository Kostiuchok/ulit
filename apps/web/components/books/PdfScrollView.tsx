interface PageEntry {
  page: number;
  url: string;
}

interface Props {
  pages: PageEntry[];
}

// "PDF" sub-mode — a continuous vertical scroll through every page, each its
// own bordered/numbered card, as opposed to the flipbook's one-leaf-at-a-time
// page-turn animation. Deliberately dumb/presentational — no ref API, no
// current-page tracking, just a scrollable list (pages can lazy-load since
// all of them mount at once here, unlike the flipbook).
export function PdfScrollView({ pages }: Props) {
  return (
    <div className="flex max-h-[70vh] flex-col items-center gap-6 overflow-y-auto bg-gray-50 py-10">
      {pages.map((p) => (
        <div key={p.page} className="flex flex-col items-center gap-2">
          <img
            src={p.url}
            alt={`Сторінка ${p.page}`}
            loading="lazy"
            className="max-w-full rounded-sm border border-gray-200 bg-white shadow-md"
          />
          <span className="text-xs text-gray-400">
            {p.page} / {pages.length}
          </span>
        </div>
      ))}
    </div>
  );
}

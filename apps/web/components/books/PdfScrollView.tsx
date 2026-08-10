interface PageEntry {
  page: number;
  url: string;
}

interface Props {
  coverUrl?: string | null;
  pages: PageEntry[];
}

// Same on-screen width for every card regardless of each image's own native
// pixel size (the cover exports at ~1800px, PDF pages render at 96 DPI --
// without a shared width they'd each fill up to their own natural size and
// visibly disagree, cover looking "full width" next to narrower pages).
const CARD_WIDTH = "w-full max-w-[420px]";

// Continuous vertical scroll through the cover + every page, each its own
// bordered/numbered card — like a PDF reader, as opposed to a flip
// animation (currently hidden/unused elsewhere in this component).
export function PdfScrollView({ coverUrl, pages }: Props) {
  return (
    <div className="flex max-h-[70vh] flex-col items-center gap-6 overflow-y-auto bg-gray-50 py-10">
      {coverUrl && (
        <div className="flex flex-col items-center gap-2">
          <img
            src={coverUrl}
            alt="Обкладинка"
            loading="eager"
            className={`${CARD_WIDTH} rounded-sm border border-gray-200 bg-white shadow-md`}
          />
          <span className="text-xs text-gray-400">Обкладинка</span>
        </div>
      )}
      {pages.map((p) => (
        <div key={p.page} className="flex flex-col items-center gap-2">
          <img
            src={p.url}
            alt={`Сторінка ${p.page}`}
            loading="lazy"
            className={`${CARD_WIDTH} rounded-sm border border-gray-200 bg-white shadow-md`}
          />
          <span className="text-xs text-gray-400">
            {p.page} / {pages.length}
          </span>
        </div>
      ))}
    </div>
  );
}

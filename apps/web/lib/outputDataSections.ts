// Shared between output-data's layout/nav (OutputDataTabs.tsx) and every one
// of its 6 route pages, plus rejectedBlocks.ts's rejection-line targets --
// used to live duplicated in output-data/page.tsx (a route file, not
// importable) and again inline in rejectedBlocks.ts; now a real shared
// module both import from.
export const SECTION_LABELS = {
  info: "Інформація",
  file: "Рукопис",
  cover: "Обкладинка",
  price: "Ціна та розповсюдження",
  review: "Огляд перед публікацією",
  publish: "Публікація",
} as const;

export const SECTION_ORDER = Object.keys(SECTION_LABELS) as (keyof typeof SECTION_LABELS)[];

export type OutputDataSectionKey = keyof typeof SECTION_LABELS;

// "info" lives at the bare /output-data route (mirrors dashboard/settings/
// page.tsx being the default "profile" tab) -- every other key gets its own
// sub-path.
export const SECTION_PATH: Record<OutputDataSectionKey, string> = {
  info: "",
  file: "/file",
  cover: "/cover",
  price: "/price",
  review: "/review",
  publish: "/publish",
};

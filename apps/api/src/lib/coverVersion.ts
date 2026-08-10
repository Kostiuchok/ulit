// Cover/back-cover files are stored under a fixed object key per book
// (public/covers/{id}.{ext}) so browsers cache the image by URL — after
// re-saving in the cover editor, every other page (dashboard, sidebar,
// store) kept showing the old cached bytes at the same URL. Appending
// updatedAt as a cache-busting query param forces a fresh fetch whenever
// the book record actually changed.
export function withCoverVersion<T extends Record<string, any> | null>(record: T): T {
  if (!record) return record;
  const updatedAt = record.updatedAt instanceof Date ? record.updatedAt : null;
  if (!updatedAt || (!record.coverUrl && !record.backCoverUrl)) return record;
  const v = updatedAt.getTime();
  return {
    ...record,
    coverUrl: record.coverUrl ? `${record.coverUrl}?v=${v}` : record.coverUrl,
    backCoverUrl: record.backCoverUrl ? `${record.backCoverUrl}?v=${v}` : record.backCoverUrl,
  };
}

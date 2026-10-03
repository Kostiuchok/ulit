// Cover/back-cover files are stored under a fixed object key per book
// (public/covers/{id}.{ext}) so browsers cache the image by URL — after
// re-saving in the cover editor, every other page (dashboard, sidebar,
// store) kept showing the old cached bytes at the same URL. Appending a
// version as a cache-busting query param forces a fresh fetch whenever the
// image itself actually changed.
//
// Prefers coverUpdatedAt (bumped ONLY by upload-cover/upload-back-cover/
// upload-spine) over the blanket `updatedAt` (bumped by every PATCH, incl.
// price/distribution edits that never touch the image bytes) -- same split
// printMetaUpdatedAt already made for the print PDF. Falls back to
// `updatedAt` when coverUpdatedAt is null, which covers every row written
// before this column existed (their cover was last touched whenever
// `updatedAt` says, same as before this change) without needing a backfill.
export function withCoverVersion<T extends Record<string, any> | null>(record: T): T {
  if (!record) return record;
  if (!record.coverUrl && !record.backCoverUrl && !record.spineUrl && !record.coverThumbUrl) return record;
  const versionAt =
    record.coverUpdatedAt instanceof Date
      ? record.coverUpdatedAt
      : record.updatedAt instanceof Date
        ? record.updatedAt
        : null;
  if (!versionAt) return record;
  const v = versionAt.getTime();
  return {
    ...record,
    coverUrl: record.coverUrl ? `${record.coverUrl}?v=${v}` : record.coverUrl,
    backCoverUrl: record.backCoverUrl ? `${record.backCoverUrl}?v=${v}` : record.backCoverUrl,
    spineUrl: record.spineUrl ? `${record.spineUrl}?v=${v}` : record.spineUrl,
    coverThumbUrl: record.coverThumbUrl ? `${record.coverThumbUrl}?v=${v}` : record.coverThumbUrl,
  };
}

// Same problem, same fix, for User.avatarUrl (public/avatars/{userId}.{ext},
// same fixed-key-per-user shape) -- reported as "avatar won't update" after
// a fresh page load/other session kept showing the old photo even though
// the upload itself succeeded. `updatedAt` bumps on any User field change
// (not avatar-specific), same accepted tradeoff withCoverVersion already
// makes for Book.updatedAt -- an occasional harmless extra re-fetch of
// identical bytes, never a stale one.
export function withAvatarVersion<T extends Record<string, any> | null>(record: T): T {
  if (!record) return record;
  const updatedAt = record.updatedAt instanceof Date ? record.updatedAt : null;
  if (!updatedAt || !record.avatarUrl) return record;
  return { ...record, avatarUrl: `${record.avatarUrl}?v=${updatedAt.getTime()}` };
}

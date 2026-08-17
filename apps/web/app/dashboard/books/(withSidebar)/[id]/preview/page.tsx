"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

// T-2057 -- this page used to run its own preview pipeline (page-thumbnail
// flipbook via BookViewer, /api/books/:id/pages -- a LibreOffice render of
// the raw uploaded .docx, unrelated to the manuscript editor's own
// "Передперегляд"). Two different previews that could show two different
// things was a real, reported bug (docs/T-2057-live-test-checklist.md).
// Every author-facing link to this route now points straight at the real
// one instead (AuthorBooksSidebar.tsx, cover/page.tsx); this redirect only
// catches anyone who still has the old URL bookmarked/cached.
export default function LegacyPreviewRedirect() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/dashboard/books/${id}/manuscript/preview`);
  }, [id, router]);

  return null;
}

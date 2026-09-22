"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { OutputDataTabs } from "@/components/dashboard/OutputDataTabs";
import { useBook } from "@/hooks/useBook";
import { getUnresolvedRejectionLines, type OutputDataSectionKey as RejectionTargetKey } from "@/lib/rejectedBlocks";
import { isPublishStepComplete } from "shared-types";

// Trimmed to exactly what this layout needs: PublishStepBook's fields (for
// the nav's ✓/○ badges) + RejectionFieldState's fields (for the banner) +
// moderation/status. Every leaf page defines its own separately-trimmed
// interface for what IT needs -- same no-shared-Book-type convention as the
// rest of apps/web (20+ existing precedents), not centralized here either.
interface LayoutBook {
  status?: string | null;
  title?: string | null;
  description?: string | null;
  genre?: string | null;
  language?: string | null;
  ageRating?: string | null;
  authorBio?: string | null;
  coverUrl?: string | null;
  originalDocxUrl?: string | null;
  pdfUrl?: string | null;
  epubUrl?: string | null;
  priceEbook?: number | string | null;
  pricePrint?: number | string | null;
  pricePrintHardcover?: number | string | null;
  pricePrintBw?: number | string | null;
  pricePrintHardcoverBw?: number | string | null;
  desiredRoyaltyAmount?: number | string | null;
  desiredRoyaltyAmountPrint?: number | string | null;
  bookAuthors?: { lastName: string; firstName: string }[] | null;
  moderationStatus?: string | null;
  moderationNote?: string | null;
  moderationReasons?: string[] | null;
  moderationCustomNote?: string | null;
  moderationFieldSnapshot?: unknown;
}

const TARGET_HREF: Partial<Record<RejectionTargetKey, string>> = {
  info: "",
  file: "/file",
  price: "/price",
};

export default function OutputDataLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const { book } = useBook<LayoutBook>(id);
  const base = `/dashboard/books/${id}/output-data`;

  const infoSectionDone = isPublishStepComplete("info", book ?? {});
  const fileSectionDone = isPublishStepComplete("file", book ?? {});
  const coverSectionDone = isPublishStepComplete("cover", book ?? {});
  const priceSectionDone = isPublishStepComplete("price", book ?? {});

  const unresolvedRejectionLines = book ? getUnresolvedRejectionLines(book) : [];
  const unresolvedCategory = (cat: (typeof unresolvedRejectionLines)[number]["category"]) =>
    unresolvedRejectionLines.some((l) => l.category === cat);
  const infoCardRejected =
    unresolvedCategory("title") ||
    unresolvedCategory("description") ||
    unresolvedCategory("genre") ||
    unresolvedCategory("author") ||
    unresolvedCategory("language");
  const priceCardRejected = unresolvedCategory("price");
  const manuscriptRejected = unresolvedCategory("manuscript");
  const coverRejected = unresolvedCategory("cover");
  const showRejection = infoCardRejected || priceCardRejected || manuscriptRejected;

  const readyToPublish =
    infoSectionDone && !infoCardRejected &&
    fileSectionDone && !manuscriptRejected &&
    coverSectionDone && !coverRejected &&
    priceSectionDone && !priceCardRejected;

  const sectionDone = {
    info: infoSectionDone && !infoCardRejected,
    file: fileSectionDone && !manuscriptRejected,
    cover: coverSectionDone && !coverRejected,
    price: priceSectionDone && !priceCardRejected,
    review: readyToPublish,
    publish: readyToPublish,
  };

  // Drives OutputDataTabs' "Публікація" pill: whether it's a real
  // "Опублікувати →" action trigger, or just a plain nav link (once the book
  // is PROCESSING/REVIEW/PUBLISHED, PublishButton on that page already shows
  // its own static status badge for those, so the pill is just a link).
  // UNPUBLISHED belongs here too -- a book taken down via "Зняти з
  // публікації" and then edited can go through this exact same
  // validate-then-submit-to-moderation flow (PublishButton's generic
  // fallback branch, and POST /api/books/:id/publish server-side, both
  // already accept UNPUBLISHED -> REVIEW). Live bug: excluding it here left
  // the pill a dead plain link for an unpublished-then-resubmitted book --
  // readyToPublish was true, but the pill never switched into its trigger
  // state, so "Опублікувати" never appeared no matter how many times the
  // author resubmitted.
  const isDraftStatus = !book?.status || book.status === "DRAFT" || book.status === "UNPUBLISHED";

  return (
    <div className="p-8">
      <div className="space-y-6">
        {/* Sticky title+nav, same as before the route split -- only this
            block is sticky, not the rejection banner or the page content
            below it. `-mx-8`/`px-8` bleeds the white background to the edges
            of this layout's own `p-8` padding while scrolling underneath it.
            (docs journal #11: `sticky` always opens a new stacking context --
            render any future fixed/modal element via a portal, not inline.) */}
        <div className="sticky top-0 z-10 -mx-8 border-b bg-white px-8 pt-5 pb-2.5 shadow-sm">
          <h1 className="mb-2.5 text-lg font-semibold text-gray-900">Вихідні дані</h1>
          <OutputDataTabs bookId={id} sectionDone={sectionDone} isDraftStatus={isDraftStatus} readyToPublish={readyToPublish} />
        </div>

        {showRejection && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p className="mb-1.5 font-medium">Модератор зазначив зауваження щодо метаданих:</p>
            <div className="space-y-0.5">
              {unresolvedRejectionLines.map((l, i) => {
                const target = l.section;
                if (target === "cover-page") {
                  return (
                    <Link
                      key={i}
                      href={`/dashboard/books/${id}/cover`}
                      className="block whitespace-pre-wrap underline decoration-red-300 hover:decoration-red-600"
                    >
                      {l.text}
                    </Link>
                  );
                }
                const href = target ? TARGET_HREF[target] : undefined;
                if (href !== undefined) {
                  return (
                    <Link
                      key={i}
                      href={base + href}
                      className="block whitespace-pre-wrap underline decoration-red-300 hover:decoration-red-600"
                    >
                      {l.text}
                    </Link>
                  );
                }
                return (
                  <p key={i} className="whitespace-pre-wrap">
                    {l.text}
                  </p>
                );
              })}
            </div>
          </div>
        )}

        {children}

        <div className="text-center pb-2">
          <Link
            href={`/dashboard/books/${id}`}
            className="text-sm text-gray-500 underline hover:no-underline hover:text-gray-900"
          >
            До дашборду книги →
          </Link>
        </div>
      </div>
    </div>
  );
}

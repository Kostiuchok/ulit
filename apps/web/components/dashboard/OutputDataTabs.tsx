"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SECTION_LABELS, SECTION_ORDER, SECTION_PATH, type OutputDataSectionKey } from "@/lib/outputDataSections";

interface Props {
  bookId: string;
  sectionDone: Record<OutputDataSectionKey, boolean>;
  // "Публікація" is a real action while the book hasn't been submitted yet
  // (not just a nav link) -- once it's PROCESSING/REVIEW/PUBLISHED,
  // PublishButton on that page already renders its own static status badge,
  // so the tab is just a plain link like every other one.
  isDraftStatus: boolean;
  readyToPublish: boolean;
}

export function OutputDataTabs({ bookId, sectionDone, isDraftStatus, readyToPublish }: Props) {
  const pathname = usePathname();
  const base = `/dashboard/books/${bookId}/output-data`;

  return (
    <nav className="flex gap-1 overflow-x-auto">
      {SECTION_ORDER.map((key) => {
        const href = base + SECTION_PATH[key];
        // None of the 6 leaf paths is a prefix of another (they all diverge
        // right after the shared /output-data base) -- plain equality is
        // enough, no startsWith special-casing needed (unlike ProfileTabs.tsx,
        // whose root hrefs ARE prefixes of their own sub-pages).
        const active = pathname === href;
        const isPublishTrigger = key === "publish" && isDraftStatus;
        const publishDisabled = isPublishTrigger && !readyToPublish;
        const label = isPublishTrigger && readyToPublish ? "Опублікувати →" : SECTION_LABELS[key];

        const pillClassName = cn(
          "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
          publishDisabled
            ? "cursor-not-allowed text-gray-400 opacity-60"
            : isPublishTrigger
              ? "bg-green-600 text-white hover:bg-green-700"
              : active
                ? "bg-gray-900 text-white"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
        );

        const badge = (
          <span
            aria-hidden
            title={sectionDone[key] ? "Виконано" : "Ще не виконано"}
            className={cn(
              "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[0.625rem] font-black leading-none",
              sectionDone[key] ? "bg-green-500 text-white" : "bg-gray-300 text-transparent"
            )}
          >
            ✓
          </span>
        );

        if (publishDisabled) {
          return (
            <span key={key} title="Заповніть усі розділи вище, щоб надіслати книгу на модерацію" className={pillClassName}>
              {badge}
              {label}
            </span>
          );
        }

        // Landing directly on the "ready to publish" panel is a deliberate
        // one-click shortcut (kept from the pre-route-split behavior) --
        // publish/page.tsx reads this and calls PublishButtonHandle.submit()
        // itself on mount, instead of the nav needing a ref into a page it
        // hasn't rendered yet.
        const finalHref = isPublishTrigger && readyToPublish ? `${href}?autovalidate=1` : href;

        return (
          <Link key={key} href={finalHref} className={pillClassName}>
            {badge}
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, X } from "lucide-react";
import { CoverDesigner } from "@/components/books/CoverDesigner";
import type { CoverFormat } from "@/components/books/CoverDesignerCanvas";
import { useApi } from "@/hooks/useApi";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { getAllRejectionLines } from "@/lib/rejectedBlocks";
import { resolveBookPrintFormat } from "shared-types";

interface BookAuthor {
  lastName: string;
  firstName: string;
  middleName?: string;
}

interface BookInfo {
  id: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  isbn?: string | null;
  coverUrl?: string | null;
  backCoverUrl?: string | null;
  spineUrl?: string | null;
  coverDesign?: { front: any[]; backSpine: any[]; background: { color: string; imageUrl?: string } } | null;
  coverImageLibrary?: { url: string; uploadedAt: string; kind?: "slot" | "background" }[] | null;
  pageCount?: number | null;
  moderationStatus?: string | null;
  moderationNote?: string | null;
  moderationReasons?: string[] | null;
  moderationCustomNote?: string | null;
  moderationFieldSnapshot?: unknown;
  bookAuthors?: BookAuthor[] | null;
  authorBio?: string | null;
  coverIndependentFromBookData?: boolean;
  genre?: string | null;
  printWidthMm?: number | null;
  printHeightMm?: number | null;
  printFormatKey?: string | null;
}

// T-2060 п.4/п.6 -- "Вихідні дані" (bookAuthors/authorBio) is the canonical
// per-book source, independent of the account profile; falls back to the
// account name only if the author hasn't filled in structured book authors
// yet (e.g. a brand-new book).
function formatBookAuthorName(authors: BookAuthor[] | null | undefined, fallback: string): string {
  if (!authors || authors.length === 0) return fallback;
  return authors
    .map((a) => [a.lastName, a.firstName, a.middleName].filter(Boolean).join(" "))
    .join(", ");
}

const FORMATS: { key: CoverFormat; label: string }[] = [
  { key: "ebook", label: "Електронна версія" },
  { key: "softcover", label: "М'яка обкладинка" },
  { key: "hardcover", label: "Тверда обкладинка" },
];

export default function CoverPage() {
  const { id } = useParams<{ id: string }>();
  const { apiFetch, token } = useApi();
  const { data: session } = useSession();
  const [book, setBook] = useState<BookInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [format, setFormat] = useState<CoverFormat>("ebook");
  const [saved, setSaved] = useState(false);
  const [coverNoticeDismissed, setCoverNoticeDismissed] = useState(false);
  const [independentSaving, setIndependentSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiFetch<{ book: BookInfo }>(`/api/books/${id}`)
      .then(({ book }) => setBook(book))
      .finally(() => setLoading(false));
  }, [token, id]);

  const trimFormat = resolveBookPrintFormat(book ?? {});
  // Resolved via the same snapshot-diff every other rejection-aware page
  // uses (rejectedBlocks.ts) -- for a book rejected via the admin's
  // structured reasons, "resolved" means the cover CHANGED since rejection,
  // not merely "a cover exists" (a cover flagged for bad quality already
  // has one, so a bare presence check would show it "fixed" immediately,
  // before the author touched anything). A legacy freeform-only rejection
  // falls back to the old presence check.
  const coverLines = book ? getAllRejectionLines(book).filter((l) => l.category === "cover") : [];
  const coverRejected = coverLines.length > 0;
  const coverResolved = coverRejected && coverLines.every((l) => l.resolved);
  const coverNoteLines = coverLines;

  async function toggleIndependent(next: boolean) {
    setBook((b) => (b ? { ...b, coverIndependentFromBookData: next } : b));
    setIndependentSaving(true);
    try {
      await apiFetch(`/api/books/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ coverIndependentFromBookData: next }),
      });
    } catch {
      // Revert on failure -- avoids the UI silently claiming a state the
      // server never persisted.
      setBook((b) => (b ? { ...b, coverIndependentFromBookData: !next } : b));
    } finally {
      setIndependentSaving(false);
    }
  }

  function handleSaved(patch: { coverUrl?: string; backCoverUrl?: string; spineUrl?: string }) {
    // No separate "locally fixed" flag needed anymore -- coverResolved above
    // already derives straight from book.coverUrl (compared against its
    // rejection-time snapshot), which this same patch just updated.
    setBook((b) => (b ? { ...b, ...patch } : b));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function handleLibraryChange(library: { url: string; uploadedAt: string; kind?: "slot" | "background" }[]) {
    setBook((b) => (b ? { ...b, coverImageLibrary: library } : b));
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="h-96 bg-gray-100 animate-pulse rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-4 border-b border-gray-200 px-6 py-3">
        <Link
          href={`/dashboard/books/${id}`}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ChevronLeft size={14} className="shrink-0" />
          Обкладинка
        </Link>

        <div className="flex gap-1 rounded-lg border p-1 bg-gray-50">
          {FORMATS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFormat(f.key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                format === f.key ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <Link
          href={`/dashboard/books/${id}/manuscript/preview`}
          className="ml-auto text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          Друкований PDF →
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {saved && (
          <div className="mb-4 rounded-md bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">
            ✓ Обкладинку збережено
          </div>
        )}

        {/* Monitors the real coverUrl instead of "did the author click save
            at all" (locallyFixed used to dismiss this the moment ANY cover
            edit was saved, fixed or not) -- flips to a green resolved state
            the moment a cover actually exists, no save/dismiss required to
            notice that, and stays dismissable by hand either way. */}
        {coverRejected && !coverNoticeDismissed && (
          <div
            className={cn(
              "relative mb-4 rounded-xl border p-4 pr-11 text-sm",
              coverResolved ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"
            )}
          >
            <button
              type="button"
              onClick={() => setCoverNoticeDismissed(true)}
              aria-label="Закрити"
              className={cn(
                "absolute right-2.5 top-2.5 rounded p-1 transition-colors",
                coverResolved ? "text-green-500 hover:bg-green-100" : "text-red-500 hover:bg-red-100"
              )}
            >
              <X size={16} />
            </button>
            <p className="font-medium">
              {coverResolved ? "✓ Обкладинка додана" : "Модератор зазначив зауваження щодо обкладинки:"}
            </p>
            {!coverResolved && coverNoteLines.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {coverNoteLines.map((l, i) => (
                  <p key={i} className="whitespace-pre-wrap">{l.text}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Cover canvas geometry now follows the book's real print trim
            size (resolveBookPrintFormat) instead of one fixed ratio for
            every book -- this makes that visible, since it isn't obvious
            from the canvas alone that its shape is tied to "Вихідні дані"
            → жанр/розмір, and changing genre later changes it. */}
        <p className="mb-3 inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-600">
          📐 Ця обкладинка розробляється для книжки розміром:{" "}
          <span className="font-semibold text-gray-900">{trimFormat.widthMm}×{trimFormat.heightMm}мм</span>
        </p>

        <label className="mb-3 flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={!!book?.coverIndependentFromBookData}
            onChange={(e) => toggleIndependent(e.target.checked)}
            disabled={independentSaving}
            className="rounded border-gray-300"
          />
          Редагувати текст на обкладинці незалежно від даних книги
          <span className="text-xs text-gray-400">
            (якщо вимкнено — назва/автор/анотація/біографія на обкладинці автоматично оновлюються слідом за «Вихідні дані»)
          </span>
        </label>

        <div
          className={cn(
            "rounded-xl border bg-white p-6 shadow-sm transition-shadow",
            coverRejected && !coverResolved && !coverNoticeDismissed && "ring-2 ring-yellow-400 ring-offset-2"
          )}
        >
          <CoverDesigner
            bookId={id}
            bookTitle={book?.title ?? "Назва книги"}
            bookAuthor={formatBookAuthorName(book?.bookAuthors, session?.user?.name ?? "Автор")}
            subtitle={book?.subtitle}
            description={book?.description}
            authorBio={book?.authorBio}
            isbn={book?.isbn}
            pageCount={book?.pageCount}
            trimMm={{ widthMm: trimFormat.widthMm, heightMm: trimFormat.heightMm }}
            format={format}
            existingCoverUrl={book?.coverUrl}
            savedDesign={book?.coverDesign}
            coverImageLibrary={book?.coverImageLibrary ?? []}
            syncFromBookData={!book?.coverIndependentFromBookData}
            onSaved={handleSaved}
            onLibraryChange={handleLibraryChange}
            token={token}
          />
        </div>

        <p className="mt-3 text-xs text-gray-400 text-center">
          Обкладинка буде збережена у форматі PNG {Math.round((trimFormat.widthMm / 25.4) * 300)}×
          {Math.round((trimFormat.heightMm / 25.4) * 300)} px (300 DPI) на панель
        </p>
      </div>
    </div>
  );
}

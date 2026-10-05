"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, FileText, X } from "lucide-react";
import { CoverDesigner } from "@/components/books/CoverDesigner";
import type { CoverFormat } from "@/components/books/CoverDesignerCanvas";
import { useApi } from "@/hooks/useApi";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { getAllRejectionLines } from "@/lib/rejectedBlocks";
import { resolveBookPrintFormat, coverLockedUntil, formatAuthorFullName } from "shared-types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

function coverAuthorLine(book: { bookAuthors?: { lastName?: string; firstName?: string }[] | null } | null | undefined): string {
  const a = (book?.bookAuthors ?? []).find((x) => x?.lastName?.trim() && x?.firstName?.trim());
  return a ? `${a.firstName} ${a.lastName}`.trim() : "";
}

interface BookInfo {
  id: string;
  title: string;
  slug?: string | null;
  status?: string | null;
  coverApprovedAt?: string | null;
  pendingCoverUrl?: string | null;
  pendingBackCoverUrl?: string | null;
  pendingSpineUrl?: string | null;
  bookAuthors?: { lastName: string; firstName: string; photoUrl?: string }[] | null;
  subtitle?: string | null;
  description?: string | null;
  isbn?: string | null;
  coverUrl?: string | null;
  backCoverUrl?: string | null;
  spineUrl?: string | null;
  coverDesign?: {
    front: any[];
    backSpine: any[];
    background: { color: string; imageUrl?: string };
    style?: { id: string; baseColor: string } | null;
  } | null;
  autoCoverStyleId?: string | null;
  autoCoverBaseColor?: string | null;
  coverImageLibrary?: { url: string; uploadedAt: string; kind?: "slot" | "background" }[] | null;
  pageCount?: number | null;
  printPageCount?: number | null;
  moderationStatus?: string | null;
  moderationNote?: string | null;
  moderationReasons?: string[] | null;
  moderationCustomNote?: string | null;
  moderationFieldSnapshot?: unknown;
  authorBio?: string | null;
  coverIndependentFromBookData?: boolean;
  genre?: string | null;
  printWidthMm?: number | null;
  printHeightMm?: number | null;
  printFormatKey?: string | null;
  printPdfUrl?: string | null;
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
  const [otherBookCovers, setOtherBookCovers] = useState<string[]>([]);

  useEffect(() => {
    if (!token) return;
    apiFetch<{ book: BookInfo }>(`/api/books/${id}`)
      .then(({ book }) => setBook(book))
      .finally(() => setLoading(false));
    // Back cover's optional "Інші книги автора на ULIT" block -- the
    // author's other PUBLISHED books that have a cover, at most three.
    apiFetch<{ books: { id: string; status: string; coverThumbUrl?: string | null; coverUrl?: string | null }[] }>("/api/books")
      .then(({ books }) =>
        setOtherBookCovers(
          books
            .filter((b) => b.id !== id && b.status === "PUBLISHED" && (b.coverUrl || b.coverThumbUrl))
            .slice(0, 3)
            .map((b) => (b.coverUrl || b.coverThumbUrl) as string)
        )
      )
      .catch(() => {});
  }, [token, id]);

  const trimFormat = resolveBookPrintFormat(book ?? {});
  // WF-SPEC 08 п.13 -- a published book's cover goes through admin approval
  // and is then locked for 90 days (Phase 3 backend); the editor's bottom
  // bar says so before the author spends time on changes that can't be saved.
  const isPublished = book?.status === "PUBLISHED";
  const lockedUntil = isPublished ? coverLockedUntil(book?.coverApprovedAt ?? null) : null;
  const lockedUntilLabel = lockedUntil ? lockedUntil.toLocaleDateString("uk-UA") : null;
  const bookUrl = book?.slug && typeof window !== "undefined" ? `${window.location.origin}/books/${book.slug}` : null;
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

  function handleSaved(patch: { coverUrl?: string; backCoverUrl?: string; spineUrl?: string }) {
    // No separate "locally fixed" flag needed anymore -- coverResolved above
    // already derives straight from book.coverUrl (compared against its
    // rejection-time snapshot), which this same patch just updated.
    setBook((b) => (b ? { ...b, ...patch } : b));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    // Every other view of this book (output-data's "Обкладинка" tab pill,
    // the sidebar's needsAttention dot) holds its own separate useBook(id)
    // instance -- without this, saving here left them all stuck on the
    // pre-save state until a full reload.
    window.dispatchEvent(new Event("ulit:books-changed"));
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

        <Tabs value={format} onValueChange={(v) => setFormat(v as CoverFormat)}>
          <TabsList className="border">
            {FORMATS.map((f) => (
              <TabsTrigger key={f.key} value={f.key} className="text-xs">
                {f.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* This is the button that assembles the actual print document
            (lazily generates it on open, print-preview.ts) -- same visual
            weight as "Зберегти обкладинку" (CoverDesignerCanvas), not a
            plain text link, so it doesn't read as a minor secondary action.
            "Передперегляд книги" (renamed from "PDF для друку" on author
            feedback -- that read as a technical/production artifact rather
            than something meant for the author to look at, so it went
            unclicked). The pill makes clear this isn't optional: unset, it's
            required for print sales + the УДК deposit copy (see "Готовність
            до реєстрації УДК" on "Вихідні дані"); once generated, it just
            confirms that's done. Tooltip still names the actual PDF file,
            not the button's own action label. */}
        {/* WF-SPEC 08 п.1 / критерій 22 -- outline: the editor's one primary
            action is "Зберегти обкладинку". Still visibly required via the
            amber pill below, just no longer a second competing primary. */}
        <Button
          asChild
          variant="outline"
          className="ml-auto shrink-0 whitespace-nowrap"
          title={
            book?.printPdfUrl
              ? "PDF для друку згенеровано"
              : "Ще не згенеровано. Потрібен для продажу друкованої книги та заявки на УДК — натисніть, щоб створити"
          }
        >
          <Link href={`/dashboard/books/${id}/manuscript/preview`}>
            <FileText size={15} />
            Передперегляд книги
            {book?.printPdfUrl ? (
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-green-100 text-[10px] leading-none text-green-700">✓</span>
            ) : (
              <span className="shrink-0 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-amber-950">
                обов&apos;язково
              </span>
            )}
          </Link>
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {isPublished && book?.pendingCoverUrl && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            Нова обкладинка вже на перевірці — читачі бачать попередню. Нове збереження замінить ту, що чекає на схвалення.
          </div>
        )}

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
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setCoverNoticeDismissed(true)}
              aria-label="Закрити"
              className={cn(
                "absolute right-2.5 top-2.5 h-auto w-auto rounded p-1",
                coverResolved ? "text-green-500 hover:bg-green-100 hover:text-green-500" : "text-red-500 hover:bg-red-100 hover:text-red-500"
              )}
            >
              <X size={16} />
            </Button>
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

        <Card
          className={cn(
            "p-6 shadow-sm transition-shadow",
            coverRejected && !coverResolved && !coverNoticeDismissed && "ring-2 ring-yellow-400 ring-offset-2"
          )}
        >
          <CoverDesigner
            bookId={id}
            bookTitle={book?.title ?? "Назва книги"}
            // Same author line the style picker uses ("Ім'я Прізвище" of the
            // book's first author), so a style looks the same in both places.
            bookAuthor={coverAuthorLine(book) || session?.user?.name || "Автор"}
            backAuthorName={formatAuthorFullName(book?.bookAuthors)}
            coverStyleHint={{ id: book?.autoCoverStyleId, baseColor: book?.autoCoverBaseColor }}
            genre={book?.genre}
            subtitle={book?.subtitle}
            description={book?.description}
            authorBio={book?.authorBio}
            isbn={book?.isbn}
            pageCount={book?.printPageCount ?? book?.pageCount}
            trimMm={{ widthMm: trimFormat.widthMm, heightMm: trimFormat.heightMm }}
            format={format}
            // A published book's cover awaiting approval is "the current
            // cover" from the author's side -- that is what they last saved.
            existingCoverUrl={book?.pendingCoverUrl ?? book?.coverUrl}
            existingBackCoverUrl={book?.pendingBackCoverUrl ?? book?.backCoverUrl}
            existingSpineUrl={book?.pendingSpineUrl ?? book?.spineUrl}
            savedDesign={book?.coverDesign}
            coverImageLibrary={book?.coverImageLibrary ?? []}
            syncFromBookData={!book?.coverIndependentFromBookData}
            bookUrl={bookUrl}
            authorPhotoUrl={(book?.bookAuthors ?? []).find((a) => a?.photoUrl?.trim())?.photoUrl ?? null}
            otherBookCovers={otherBookCovers}
            isPublished={isPublished}
            lockedUntilLabel={lockedUntilLabel}
            onSaved={handleSaved}
            onLibraryChange={handleLibraryChange}
            token={token}
          />
        </Card>

      </div>
    </div>
  );
}

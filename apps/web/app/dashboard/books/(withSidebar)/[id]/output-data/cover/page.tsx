"use client";

import { useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Expand, Info, Lock, Upload } from "lucide-react";
import { OutputDataSectionHeading } from "@/components/dashboard/OutputDataSectionHeading";
import { CollapsibleSection } from "@/components/dashboard/CollapsibleSection";
import { CoverPrintSpread } from "@/components/books/CoverPrintSpread";
import { TabletCoverFrame } from "@/components/books/TabletCoverFrame";
import { AutoCoverPicker } from "@/components/books/AutoCoverPicker";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useBook } from "@/hooks/useBook";
import { useApi } from "@/hooks/useApi";
import { getUnresolvedRejectionLines } from "@/lib/rejectedBlocks";
import { SECTION_LABELS } from "@/lib/outputDataSections";
import { cn } from "@/lib/utils";
import {
  isPublishStepComplete,
  resolveBookPrintFormat,
  effectivePageCount,
  coverLockedUntil,
  isSpineTooThinForText,
  COVER_BLEED_MM,
  MIN_SPINE_TEXT_PAGES,
} from "shared-types";

interface CoverBook {
  status?: string | null;
  slug?: string | null;
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  authorBio?: string | null;
  isbn?: string | null;
  bookAuthors?: { lastName: string; firstName: string; middleName?: string; photoUrl?: string }[] | null;
  autoCoverStyleId?: string | null;
  autoCoverBaseColor?: string | null;
  coverUrl?: string | null;
  backCoverUrl?: string | null;
  spineUrl?: string | null;
  pendingCoverUrl?: string | null;
  pendingBackCoverUrl?: string | null;
  pendingSpineUrl?: string | null;
  coverApprovedAt?: string | null;
  genre?: string | null;
  printWidthMm?: number | null;
  printHeightMm?: number | null;
  printFormatKey?: string | null;
  printPageCount?: number | null;
  pageCount?: number | null;
  priceEbook?: number | string | null;
  pricePrint?: number | string | null;
  pricePrintHardcover?: number | string | null;
  moderationStatus?: string | null;
  moderationNote?: string | null;
  moderationReasons?: string[] | null;
  moderationCustomNote?: string | null;
  moderationFieldSnapshot?: unknown;
}

function fmt(d: string | Date) {
  return new Date(d).toLocaleDateString("uk-UA");
}

// WF-SPEC "06/06b/06c Обкладинка" -- Phase 3 (backend) already built the
// staging/lock this page just needs to READ: pendingCoverUrl (+back/spine)
// means a change is awaiting admin approval; coverLockedUntil(coverApprovedAt)
// is non-null while the 90-day re-change window from the last APPROVED
// change hasn't elapsed. "none" (no cover at all yet) isn't one of this
// three -- that's 06d/06e: AutoCoverPicker (14 templates themed from one
// author colour) renders a ready cover straight away. An unpublished book
// that already has a cover can reopen the picker too ("Обрати шаблон").
type CoverState = "none" | "uploaded" | "pending" | "locked";

export default function OutputDataCoverPage() {
  const { id } = useParams<{ id: string }>();
  const { book, loading, refetch } = useBook<CoverBook>(id);
  const { apiUpload } = useApi();
  const [coverFormat, setCoverFormat] = useState<"softcover" | "hardcover">("softcover");
  const [fullscreen, setFullscreen] = useState<null | "ebook" | "print">(null);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [pickTemplate, setPickTemplate] = useState(false);

  if (loading) {
    return <div className="h-96 bg-gray-200 rounded-xl animate-pulse" />;
  }

  const coverSectionDone = isPublishStepComplete("cover", book ?? {});
  const unresolvedRejectionLines = book ? getUnresolvedRejectionLines(book) : [];
  const coverRejected = unresolvedRejectionLines.some((l) => l.category === "cover");
  const trimMm = book ? resolveBookPrintFormat(book) : null;
  const printPageCount = effectivePageCount(book ?? {});
  const hasPrintPrice = !!(book?.pricePrint || book?.pricePrintHardcover);

  const isPublished = book?.status === "PUBLISHED";
  const hasPendingCover = !!(book?.pendingCoverUrl || book?.pendingBackCoverUrl || book?.pendingSpineUrl);
  const lockedUntil = coverLockedUntil(book?.coverApprovedAt ?? null);

  const state: CoverState = !book?.coverUrl
    ? "none"
    : hasPendingCover
      ? "pending"
      : isPublished && lockedUntil
        ? "locked"
        : "uploaded";

  // "pending" shows the staged (new) images to the AUTHOR -- readers still
  // see the old live ones until an admin approves (WF-SPEC п.3b). Every
  // other state just shows whatever is live.
  const previewCoverUrl = state === "pending" ? book?.pendingCoverUrl ?? book?.coverUrl : book?.coverUrl;
  const previewBackCoverUrl = state === "pending" ? book?.pendingBackCoverUrl ?? book?.backCoverUrl : book?.backCoverUrl;
  const previewSpineUrl = state === "pending" ? book?.pendingSpineUrl ?? book?.spineUrl : book?.spineUrl;

  const spineTooThin = printPageCount != null && isSpineTooThinForText(printPageCount, coverFormat === "hardcover");

  // WF-SPEC п.4 -- "Перелік правил і числа — WF-заглушки, підтвердити"; this
  // list adapted to what's actually verifiable from real book data (not the
  // auto-template checklist's "назва й автор на лицевій", which assumes
  // known text layers an uploaded raster image doesn't have).
  const requirements = [
    { label: "Електронна обкладинка завантажена", done: !!book?.coverUrl },
    ...(hasPrintPrice
      ? [{ label: "Розворот для друку (задня сторона + корінець)", done: !!(book?.backCoverUrl && book?.spineUrl) }]
      : []),
    ...(hasPrintPrice && book?.backCoverUrl && book?.spineUrl
      ? [
          {
            label: "Текст на корінці",
            done: !spineTooThin,
            hint: spineTooThin
              ? `Немає — для ${printPageCount} сторінок корінець завузький для тексту (потрібно від ${MIN_SPINE_TEXT_PAGES})`
              : undefined,
          },
        ]
      : []),
  ];
  const requirementsDone = requirements.filter((r) => r.done).length;

  async function handleReplaceFile(file: File) {
    const form = new FormData();
    form.append("file", file);
    await apiUpload(`/api/books/${id}/upload-cover`, form);
    setPickTemplate(false);
    await refetch({ silent: true });
    window.dispatchEvent(new Event("ulit:books-changed"));
  }

  const actionsDisabled = state === "pending" || state === "locked";
  // The auto-cover picker: always for a book with no cover yet; on request
  // for an unpublished book that has one (a published book's cover change
  // goes through the editor / file replace + moderation instead).
  const showPicker = !!book && !!trimMm && (state === "none" || (pickTemplate && !isPublished));
  const lockedUntilLabel = lockedUntil ? fmt(lockedUntil) : null;

  return (
    <div className="space-y-3">
      {isPublished && state === "uploaded" && (
        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <Info size={18} className="mt-0.5 shrink-0 text-blue-600" />
          <div className="text-sm text-blue-900/80">
            Нову обкладинку перевіряє адміністратор. До схвалення в магазинах лишається поточна.
          </div>
        </div>
      )}

      {state === "pending" && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <span className="mt-0.5 shrink-0 text-amber-600">⚠</span>
          <div className="text-sm">
            <div className="font-semibold text-amber-900">Нова обкладинка на перевірці — читачі бачать попередню</div>
            <div className="mt-0.5 text-amber-800">Ця зміна використовує ліміт 90 днів.</div>
          </div>
        </div>
      )}

      {state === "locked" && lockedUntilLabel && (
        <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <Lock size={18} className="mt-0.5 shrink-0 text-gray-500" />
          <div className="text-sm">
            <div className="font-semibold text-gray-800">Змінити обкладинку поки не можна</div>
            <div className="mt-0.5 text-gray-600">
              Обкладинку змінено {book?.coverApprovedAt ? fmt(book.coverApprovedAt) : "—"}. Наступна зміна можлива з{" "}
              {lockedUntilLabel}.
            </div>
          </div>
        </div>
      )}

      <OutputDataSectionHeading label={SECTION_LABELS.cover} done={coverSectionDone && !coverRejected} />

      {showPicker && book && trimMm && (
        <AutoCoverPicker
          bookId={id}
          book={book}
          trimMm={trimMm}
          pageCount={printPageCount}
          onUploadOwn={() => setReplaceOpen(true)}
          onCancel={state === "none" ? undefined : () => setPickTemplate(false)}
          onApplied={async () => {
            await refetch({ silent: true });
            setPickTemplate(false);
          }}
        />
      )}

      {book?.coverUrl && !showPicker && (
        <Card className={cn("p-5 shadow-sm", coverRejected && "border-2 border-red-400")}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              {state === "pending" ? (
                <>
                  <span className="text-amber-600">🕐</span>
                  <span className="font-medium text-gray-900">Нову обкладинку завантажено · очікує схвалення</span>
                  <Badge className="rounded-full border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-50">
                    На перевірці
                  </Badge>
                </>
              ) : state === "locked" ? (
                <>
                  <Lock size={15} className="text-gray-500" />
                  <span className="font-medium text-gray-900">Збережена обкладинка</span>
                </>
              ) : (
                <>
                  <span className="text-green-600">✓</span>
                  <span className="font-medium text-gray-900">Обкладинку завантажено</span>
                  {isPublished && (
                    <Badge className="rounded-full border-green-300 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 hover:bg-green-50">
                      Зміна доступна
                    </Badge>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button asChild={!actionsDisabled} disabled={actionsDisabled} title={actionsDisabled && lockedUntilLabel ? `Наступна зміна можлива з ${lockedUntilLabel}` : undefined}>
                {actionsDisabled ? (
                  <span>Редагувати обкладинку</span>
                ) : (
                  <Link href={`/dashboard/books/${id}/cover`}>Редагувати обкладинку</Link>
                )}
              </Button>
              <Button
                variant="outline"
                disabled={actionsDisabled}
                title={actionsDisabled && lockedUntilLabel ? `Наступна зміна можлива з ${lockedUntilLabel}` : undefined}
                onClick={() => setReplaceOpen(true)}
              >
                <Upload size={14} />
                Замінити файлом
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* WF-SPEC п.2a -- показується в усіх станах, щойно є обкладинка. */}
      {book?.coverUrl && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          Обкладинку опублікованої книги можна змінювати раз на 90 днів. ISBN зберігається, якщо не змінюються
          формат, тип друку, назва чи автор, а кількість сторінок змінюється не більш ніж на 10%. Інакше потрібне
          нове видання з новим ISBN.
        </div>
      )}

      {book?.coverUrl && !showPicker && !isPublished && (
        <button type="button" onClick={() => setPickTemplate(true)} className="text-xs text-gray-600 underline hover:no-underline">
          Обрати шаблон автообкладинки
        </button>
      )}

      {book?.coverUrl && !showPicker && (
        <p className="text-xs text-gray-500">
          {state === "uploaded" && "Поточна обкладинка · лише перегляд."}
          {state === "pending" && "Нова обкладинка на перевірці · читачі бачать попередню · показано нову."}
          {state === "locked" && lockedUntilLabel && `🔒 Збережена обкладинка · лише перегляд · змінити можна з ${lockedUntilLabel}.`}
        </p>
      )}

      {book?.coverUrl && !showPicker && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="group relative cursor-pointer p-5 shadow-sm" onClick={() => setFullscreen("ebook")}>
            <p className="mb-2 text-xs font-medium text-gray-600">Електронна версія</p>
            <div className="mx-auto" style={{ maxWidth: "min(100%, 16rem, calc((100vh - 20rem) * 232 / 341))" }}>
              <TabletCoverFrame coverUrl={previewCoverUrl} />
            </div>
            <Expand size={16} className="pointer-events-none absolute right-3 top-3 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100" />
          </Card>

          {trimMm && (
            <Card className="group relative cursor-pointer p-5 shadow-sm" onClick={(e) => e.target === e.currentTarget && setFullscreen("print")}>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-gray-600">Друкована версія</p>
                <div className="flex rounded-md border border-gray-200 text-xs">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setCoverFormat("softcover"); }}
                    className={cn("rounded-l-md px-2.5 py-1", coverFormat === "softcover" ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-50")}
                  >
                    М&apos;яка
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setCoverFormat("hardcover"); }}
                    className={cn("rounded-r-md px-2.5 py-1", coverFormat === "hardcover" ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-50")}
                  >
                    Тверда
                  </button>
                </div>
              </div>
              <div onClick={() => setFullscreen("print")}>
                <CoverPrintSpread
                  coverUrl={previewCoverUrl}
                  backCoverUrl={previewBackCoverUrl}
                  spineUrl={previewSpineUrl}
                  format={coverFormat}
                  pageCount={printPageCount}
                  trimMm={trimMm}
                  label="Задня сторона · ↓ корінець · Лицева"
                />
              </div>
              <Expand size={16} className="pointer-events-none absolute right-3 top-3 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100" />
              <p className="mt-2 text-xs text-gray-400">
                ┄ пунктир — згин (корінець) · край розвороту — лінія обрізу. Вильоти {COVER_BLEED_MM} мм з
                кожного боку додаються автоматично у файлі для друкарні.
              </p>
            </Card>
          )}
        </div>
      )}

      {requirements.length > 0 && (
        <Card className="p-5 text-sm">
          <CollapsibleSection
            title={`Вимоги до обкладинки · ${requirementsDone} з ${requirements.length}`}
            defaultOpen={requirementsDone < requirements.length}
          >
            <ul className="space-y-1.5">
              {requirements.map((r) => (
                <li key={r.label} className="flex items-start gap-2">
                  <span className={cn("mt-0.5", r.done ? "text-green-600" : "text-amber-500")}>{r.done ? "✓" : "○"}</span>
                  <span className={r.done ? "text-gray-700" : "text-gray-500"}>
                    {r.label}
                    {r.hint && <span className="block text-xs text-amber-600">{r.hint}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </CollapsibleSection>
        </Card>
      )}

      <Dialog open={!!fullscreen} onOpenChange={(open) => !open && setFullscreen(null)}>
        <DialogContent className={fullscreen === "print" ? "max-w-3xl" : "max-w-xs"}>
          <DialogTitle className="sr-only">Повноекранний перегляд обкладинки</DialogTitle>
          {fullscreen === "ebook" && (
            <div className="mx-auto w-full max-w-xs">
              <TabletCoverFrame coverUrl={previewCoverUrl} />
            </div>
          )}
          {fullscreen === "print" && trimMm && (
            <CoverPrintSpread
              coverUrl={previewCoverUrl}
              backCoverUrl={previewBackCoverUrl}
              spineUrl={previewSpineUrl}
              format={coverFormat}
              pageCount={printPageCount}
              trimMm={trimMm}
              label="Задня сторона · ↓ корінець · Лицева"
            />
          )}
        </DialogContent>
      </Dialog>

      <ReplaceCoverDialog open={replaceOpen} onClose={() => setReplaceOpen(false)} onUpload={handleReplaceFile} />
    </div>
  );
}

function ReplaceCoverDialog({ open, onClose, onUpload }: { open: boolean; onClose: () => void; onUpload: (file: File) => Promise<void> }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      await onUpload(file);
      onClose();
    } catch (err: any) {
      setError(err.message || "Не вдалося завантажити обкладинку");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!uploading && !v) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogTitle className="text-center text-lg font-bold text-black">Замінити обкладинку файлом</DialogTitle>
        <p className="text-center text-sm text-gray-600">Завантажте готовий файл JPG/PNG/WebP замість редактора.</p>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleChange} className="hidden" />
        {error && <p className="text-center text-sm text-red-500">{error}</p>}
        <Button type="button" loading={uploading} onClick={() => inputRef.current?.click()} className="w-full">
          <Upload size={14} />
          Обрати файл
        </Button>
      </DialogContent>
    </Dialog>
  );
}

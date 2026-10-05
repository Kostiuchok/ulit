"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { OutputDataSectionHeading } from "@/components/dashboard/OutputDataSectionHeading";
import { CollapsibleSection } from "@/components/dashboard/CollapsibleSection";
import {
  computeAnchorPrices,
  formatUah,
  parseRoyalty,
  suggestedPriceRange,
  type PrintCost,
} from "@/components/books/FormatsAndDistribution";
import { KdpSelectPanel } from "@/components/books/KdpSelectPanel";
import { QuestionHint } from "@/components/books/QuestionHint";
import { Badge } from "@/components/ui/badge";
import { HorizontalScrollHint } from "@/components/ui/HorizontalScrollHint";
import { useOutputDataSaveBar } from "@/components/dashboard/OutputDataSaveBar";
import { ChangedBadge } from "@/components/dashboard/ChangedBadge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBook } from "@/hooks/useBook";
import { useApi } from "@/hooks/useApi";
import { DISTRIBUTION_PLATFORMS, KDP_EBOOK_UNSUPPORTED_LANGUAGES } from "@/lib/distributionPlatforms";
import { getUnresolvedRejectionLines } from "@/lib/rejectedBlocks";
import { SECTION_LABELS } from "@/lib/outputDataSections";
import { cn } from "@/lib/utils";
import {
  resolveBookPrintFormat,
  formatPrintFormatLabel,
  isPublishStepComplete,
  isDiscountActive,
  discountedPrice,
  royaltyFromPrice,
  MIN_DISCOUNT_PERCENT,
  MAX_DISCOUNT_PERCENT,
  KDP_PRINT_ROYALTY_RATE,
} from "shared-types";

interface PriceBook {
  status?: string | null;
  language: string;
  printFormatKey?: string | null;
  printWidthMm?: number | null;
  printHeightMm?: number | null;
  printPageCount?: number | null;
  pageCount?: number | null;
  genre?: string | null;
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
  discountPercent?: number | null;
  discountStartsAt?: string | null;
  discountEndsAt?: string | null;
  distributionChannels?: string[] | null;
  d2dStatus?: string | null;
  d2dSentAt?: string | null;
  kdpStatus?: string | null;
  kdpSentAt?: string | null;
  googleStatus?: string | null;
  googleSentAt?: string | null;
  moderationStatus?: string | null;
  moderationNote?: string | null;
  moderationReasons?: string[] | null;
  moderationCustomNote?: string | null;
  moderationFieldSnapshot?: unknown;
}

const EXTERNAL_STATUS_LABEL: Record<string, { label: string; className: string }> = {
  NOT_SENT: { label: "Ще не надсилали", className: "bg-gray-100 text-gray-600" },
  SENT: { label: "Надіслано", className: "bg-blue-100 text-blue-700" },
  PUBLISHED: { label: "Опубліковано", className: "bg-green-100 text-green-700" },
  ERROR: { label: "Помилка", className: "bg-red-100 text-red-700" },
  WITHDRAWN: { label: "Знято", className: "bg-gray-100 text-gray-500" },
};

// Same text wherever a KDP Select / Kindle Countdown Deal hint shows up
// (the KDP Select row AND the "Знижки в ULIT" card) -- WF-SPEC explicitly
// calls for the identical copy in both places.
const KDP_SELECT_DISCOUNT_HINT =
  "Хочете знижки на Amazon? Зареєструйтеся в KDP Select — тоді зможете запускати акції Kindle Countdown Deal (90 днів ексклюзиву електронної книги на Amazon).";

function fmtDate(d?: string | null): string {
  return d ? new Date(d).toLocaleDateString("uk-UA") : "";
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function platform(key: string) {
  return DISTRIBUTION_PLATFORMS.find((p) => p.key === key)!;
}

// yyyy-mm-dd for a date-only <input type="date">.
function toDateInputValue(d?: string | Date | null): string {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function tomorrowDateInputValue(): string {
  return toDateInputValue(new Date(Date.now() + 24 * 60 * 60 * 1000));
}

// One row of either table -- checkbox / store chip / computed shop price /
// conditions. Rows never carry their own editable input any more (bug #1,
// "Знайдені баги": the ULIT row used to duplicate the single royalty field
// above the table) -- the shared royalty input above each table is the
// only place a number is typed; every row (including ULIT's) only DISPLAYS
// the derived price.
function ChannelRow({
  icon,
  name,
  checked,
  locked,
  disabled,
  onToggle,
  shopPrice,
  shopPriceBold,
  conditions,
}: {
  icon: string;
  name: string;
  checked: boolean;
  locked?: boolean;
  disabled?: boolean;
  onToggle?: () => void;
  shopPrice: React.ReactNode;
  shopPriceBold?: boolean;
  conditions: React.ReactNode;
}) {
  return (
    <TableRow className={cn(disabled && "opacity-50")}>
      <TableCell>
        <Checkbox
          checked={checked}
          onCheckedChange={onToggle}
          disabled={locked || disabled || !onToggle}
        />
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded border bg-gray-50 px-2 py-1.5 text-[13px] font-bold text-gray-900">
          <span>{icon}</span>
          {name}
        </span>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <span className={cn("whitespace-nowrap text-sm", shopPriceBold ? "font-semibold text-gray-900" : "text-gray-700")}>
          {shopPrice}
        </span>
      </TableCell>
      <TableCell className="max-w-xs">{conditions}</TableCell>
    </TableRow>
  );
}

function PlacedBadge() {
  return (
    <Badge variant="secondary" className="rounded-sm bg-gray-200 px-2 py-1 text-[11px] font-semibold uppercase text-gray-700">
      Буде розміщена у магазині
    </Badge>
  );
}

export default function OutputDataPricePage() {
  const { id } = useParams<{ id: string }>();
  const { book, setBook, loading } = useBook<PriceBook>(id);

  // Same split as output-data/page.tsx's OutputDataInfoForm: useOutputDataSaveBar
  // (and every other hook below) must run unconditionally on every render of
  // the component it lives in -- the previous single-component version called
  // it AFTER an early "still loading" return, which is a real rules-of-hooks
  // violation (hook count differs between the loading and loaded render).
  // Mounting the form only once `book` exists sidesteps that at the root.
  if (loading || !book) {
    return <div className="h-96 bg-gray-200 rounded-xl animate-pulse" />;
  }

  return <OutputDataPriceForm key={id} book={book} bookId={id} setBook={setBook} />;
}

function OutputDataPriceForm({
  book,
  bookId: id,
  setBook,
}: {
  book: PriceBook;
  bookId: string;
  setBook: (book: PriceBook) => void;
}) {
  const { apiFetch, token } = useApi();

  const [printCost, setPrintCost] = useState<PrintCost | null>(null);
  const [channels, setChannels] = useState<string[]>(["ULIT"]);
  const [royaltyEbook, setRoyaltyEbook] = useState("");
  const [royaltyPrint, setRoyaltyPrint] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [discountStartsAt, setDiscountStartsAt] = useState("");
  const [discountEndsAt, setDiscountEndsAt] = useState("");
  const [formatsSaving, setFormatsSaving] = useState(false);
  const [formatsSaved, setFormatsSaved] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [formatsDirty, setFormatsDirty] = useState(false);
  const [formatsError, setFormatsError] = useState("");

  // Snapshot of the hydrated/last-saved values -- drives the per-block
  // amber highlighting (WF-SPEC: a block's own border, not a single
  // page-wide flag) independently of `formatsDirty` (which only gates the
  // Save button).
  const originalRef = useRef<{
    royaltyEbook: string;
    royaltyPrint: string;
    discountPercent: string;
    discountStartsAt: string;
    discountEndsAt: string;
  } | null>(null);

  function markFormatsDirty() {
    setFormatsDirty(true);
    setFormatsSaved(false);
  }

  useEffect(() => {
    if (!id || !token) return;
    apiFetch<PrintCost>(`/api/books/${id}/print-cost`).then(setPrintCost).catch(() => {});
  }, [id, token, apiFetch]);

  const bookHydratedRef = useRef(false);
  useEffect(() => {
    if (!book || bookHydratedRef.current) return;
    bookHydratedRef.current = true;
    setChannels(Array.isArray(book.distributionChannels) && book.distributionChannels.length > 0 ? book.distributionChannels : ["ULIT"]);
    const hydrated = {
      royaltyEbook: book.desiredRoyaltyAmount ? String(Number(book.desiredRoyaltyAmount)) : "",
      royaltyPrint: book.desiredRoyaltyAmountPrint ? String(Number(book.desiredRoyaltyAmountPrint)) : "",
      discountPercent: book.discountPercent != null ? String(book.discountPercent) : "",
      discountStartsAt: toDateInputValue(book.discountStartsAt),
      discountEndsAt: toDateInputValue(book.discountEndsAt),
    };
    setRoyaltyEbook(hydrated.royaltyEbook);
    setRoyaltyPrint(hydrated.royaltyPrint);
    setDiscountPercent(hydrated.discountPercent);
    setDiscountStartsAt(hydrated.discountStartsAt);
    setDiscountEndsAt(hydrated.discountEndsAt);
    originalRef.current = hydrated;
  }, [book]);

  function toggleChannel(key: string) {
    if (key === "ULIT") return;
    markFormatsDirty();
    setChannels((prev) => (prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]));
  }

  function setRoyaltyEbookDirty(v: string) {
    markFormatsDirty();
    setRoyaltyEbook(v);
  }
  function setRoyaltyPrintDirty(v: string) {
    markFormatsDirty();
    setRoyaltyPrint(v);
  }
  function setDiscountPercentDirty(v: string) {
    markFormatsDirty();
    setDiscountPercent(v);
  }
  function setDiscountStartsAtDirty(v: string) {
    markFormatsDirty();
    setDiscountStartsAt(v);
  }
  function setDiscountEndsAtDirty(v: string) {
    markFormatsDirty();
    setDiscountEndsAt(v);
  }

  async function saveFormatsAndDistribution() {
    setFormatsError("");
    // "Знижка в ULIT" -- a percent needs a real end date (not before
    // tomorrow); mirrors book.ts's own server-side check so the author
    // sees the problem before the round trip, not just after a 400.
    const discountPercentNum = discountPercent.trim() !== "" ? Number(discountPercent) : null;
    if (discountPercentNum != null) {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      tomorrow.setHours(0, 0, 0, 0);
      const endsAt = discountEndsAt ? new Date(discountEndsAt) : null;
      if (!endsAt || endsAt < tomorrow) {
        setFormatsError("Дата завершення знижки має бути не раніше завтрашнього дня");
        return;
      }
      if (discountStartsAt && new Date(discountStartsAt) >= endsAt) {
        setFormatsError("Дата початку знижки має бути раніше дати завершення");
        return;
      }
    }

    setFormatsSaving(true);
    try {
      const anchor = computeAnchorPrices(printCost, royaltyEbook, royaltyPrint);
      const cost = printCost?.status === "DONE" ? printCost : null;
      // Same formula as ULIT's color variants -- print-cost.ts has no
      // separate B&W cost basis yet (TODO, print-specs.ts), so B&W and
      // colour share the same per-binding cost until that exists; both
      // still read the one shared royaltyPrint, matching "Рішення 03.10"
      // (one royalty for all 4 print variants).
      const royaltyPrintNum = parseRoyalty(royaltyPrint);
      const pricePrintBw =
        royaltyPrintNum !== undefined && cost ? round2((cost.softcoverCost + royaltyPrintNum) / 0.7) : null;
      const pricePrintHardcoverBw =
        royaltyPrintNum !== undefined && cost ? round2((cost.hardcoverCost + royaltyPrintNum) / 0.7) : null;

      const { book: updated } = await apiFetch<{ book: PriceBook }>(`/api/books/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          desiredRoyaltyAmount: anchor.priceEbook !== undefined ? Number(royaltyEbook.replace(",", ".")) : null,
          desiredRoyaltyAmountPrint: anchor.pricePrint !== undefined ? Number(royaltyPrint.replace(",", ".")) : null,
          priceEbook: anchor.priceEbook ?? null,
          pricePrint: anchor.pricePrint ?? null,
          pricePrintHardcover: anchor.pricePrintHardcover ?? null,
          pricePrintBw,
          pricePrintHardcoverBw,
          discountPercent: discountPercentNum,
          discountStartsAt: discountPercentNum != null && discountStartsAt ? new Date(discountStartsAt).toISOString() : null,
          discountEndsAt: discountPercentNum != null && discountEndsAt ? new Date(discountEndsAt).toISOString() : null,
        }),
      });
      setBook(updated);
      await apiFetch(`/api/books/${id}/distribution`, {
        method: "PATCH",
        body: JSON.stringify({ distributionChannels: channels }),
      });
      originalRef.current = { royaltyEbook, royaltyPrint, discountPercent, discountStartsAt, discountEndsAt };
      setFormatsSaved(true);
      setFormatsDirty(false);
      setSavedAt(new Date());
      window.dispatchEvent(new Event("ulit:books-changed"));
    } catch (e: any) {
      setFormatsError(e.message || "Помилка збереження");
    } finally {
      setFormatsSaving(false);
    }
  }

  const fileSectionDone = isPublishStepComplete("file", book);
  const priceSectionDone = isPublishStepComplete("price", book);
  const unresolvedRejectionLines = getUnresolvedRejectionLines(book);
  const priceCardRejected = unresolvedRejectionLines.some((l) => l.category === "price");

  const displayFormat = resolveBookPrintFormat(book);
  const formatLabel = formatPrintFormatLabel(displayFormat);
  const pageCount = book.printPageCount ?? book.pageCount;

  const cost = printCost?.status === "DONE" ? printCost : null;
  const royaltyEbookNum = parseRoyalty(royaltyEbook);
  const royaltyPrintNum = parseRoyalty(royaltyPrint);
  const anchor = computeAnchorPrices(printCost, royaltyEbook, royaltyPrint);
  const kdpEbookUnsupported = KDP_EBOOK_UNSUPPORTED_LANGUAGES.includes(book.language);
  const isKdpSelect = channels.includes("KDP") && !channels.includes("D2D") && !channels.includes("GOOGLE");

  const ebookOriginal = originalRef.current;
  const ebookDirty = ebookOriginal ? royaltyEbook !== ebookOriginal.royaltyEbook : false;
  const printDirty = ebookOriginal ? royaltyPrint !== ebookOriginal.royaltyPrint : false;
  const discountDirty = ebookOriginal
    ? discountPercent !== ebookOriginal.discountPercent ||
      discountStartsAt !== ebookOriginal.discountStartsAt ||
      discountEndsAt !== ebookOriginal.discountEndsAt
    : false;
  const dirtyBlockCount = [ebookDirty, printDirty, discountDirty].filter(Boolean).length;

  // ── Електронна книга: ONE shared royalty drives every channel's own
  // derived price (Рішення 03.10 -- "один гонорар для е-книги, всі
  // магазини"). Rows only ever DISPLAY the result now.
  const d2dPrice = royaltyEbookNum !== undefined ? formatUah(royaltyEbookNum / platform("D2D").royaltyMin) : "—";
  const kdpRange =
    royaltyEbookNum !== undefined
      ? suggestedPriceRange(0, royaltyEbookNum, platform("KDP").royaltyMin, platform("KDP").royaltyMax)
      : null;
  const kdpPrice = kdpRange ? `від ${formatUah(kdpRange.min)}` : "—";

  // ── Друкована книга: same shared royalty -> static 2x2 matrix (colour x
  // B&W, softcover x hardcover), all four always visible -- no more
  // "pick one combination" toggle (that was the old UI; WF-SPEC always
  // shows the whole matrix).
  const printMatrix = royaltyPrintNum !== undefined && cost
    ? {
        colorSoft: round2((cost.softcoverCost + royaltyPrintNum) / 0.7),
        colorHard: round2((cost.hardcoverCost + royaltyPrintNum) / 0.7),
        // Same per-binding cost as colour -- print-cost.ts has no B&W-specific
        // cost basis yet (print-specs.ts TODO); both read the one shared
        // royalty either way.
        bwSoft: round2((cost.softcoverCost + royaltyPrintNum) / 0.7),
        bwHard: round2((cost.hardcoverCost + royaltyPrintNum) / 0.7),
      }
    : null;
  const ulitPrintFrom = printMatrix ? Math.min(printMatrix.colorSoft, printMatrix.bwSoft) : undefined;

  const kdpPrintRange =
    royaltyPrintNum !== undefined && cost
      ? suggestedPriceRange(cost.softcoverCost, royaltyPrintNum, KDP_PRINT_ROYALTY_RATE, KDP_PRINT_ROYALTY_RATE)
      : null;
  const kdpPrintPrice = kdpPrintRange ? `від ${formatUah(kdpPrintRange.min)}` : "—";

  const externalRows = (
    [
      { key: "d2d", label: "Draft2Digital", status: book.d2dStatus, sentAt: book.d2dSentAt },
      { key: "kdp", label: "Amazon KDP", status: book.kdpStatus, sentAt: book.kdpSentAt },
      { key: "google", label: "Google Play Books", status: book.googleStatus, sentAt: book.googleSentAt },
    ] as const
  ).filter((r) => channels.includes(r.key.toUpperCase()));

  // ── "Знижка в ULIT" preview -- shown only while the author is actually
  // configuring one (percent typed in, regardless of whether the dates
  // make it valid/active yet -- this is a live preview, not the real
  // isDiscountActive gate the storefront uses).
  const previewPercent = discountPercent.trim() !== "" ? Number(discountPercent) : null;
  const discountPreviewFields = { discountPercent: previewPercent, discountStartsAt: null, discountEndsAt: new Date(8.64e15) };
  const showDiscountPreview = previewPercent != null && previewPercent >= MIN_DISCOUNT_PERCENT && previewPercent <= MAX_DISCOUNT_PERCENT;

  // WF-SPEC "Спільне для 03, 05-07" -- shared sticky save bar (moved here
  // from this page's own inline button/status row, confirmed with Анатолій
  // 2026-10-05; save/validation logic in saveFormatsAndDistribution is
  // untouched). statusNote keeps this page's own richer message (block
  // count + ULIT-vs-external-timing note) instead of the bar's generic text.
  useOutputDataSaveBar({
    dirty: formatsDirty,
    unsaved: formatsDirty,
    saving: formatsSaving,
    savedAt: formatsSaved && !formatsDirty ? savedAt : null,
    onSave: saveFormatsAndDistribution,
    statusNote:
      formatsSaved && !formatsDirty && savedAt ? (
        <span className="text-sm text-green-700">Збережено ✓ · {fmtTime(savedAt)} · ULIT: застосовано</span>
      ) : dirtyBlockCount > 0 ? (
        <span className="inline-flex items-center gap-1.5 text-sm">
          <span className="text-amber-600">
            ● Є незбережені зміни у {dirtyBlockCount} {dirtyBlockCount === 1 ? "блоці" : "блоках"}
          </span>
          <span>· ULIT: одразу після збереження</span>
          <QuestionHint className="h-4 w-4">
            Amazon/D2D/Google Play: оновлення за правилами магазину (Amazon: ebook до 24 год, друк до 5 роб. днів).
          </QuestionHint>
        </span>
      ) : null,
  });

  return (
    <div className="space-y-3">
      <OutputDataSectionHeading label={SECTION_LABELS.price} done={priceSectionDone && !priceCardRejected} />

      {/* ── Продаж електронної книги ──────────────────────────────────── */}
      <Card className={cn("border border-gray-300 p-6 shadow-sm", priceCardRejected && "border-2 border-red-400", ebookDirty && !priceCardRejected && "border-2 border-amber-400")}>
          <CollapsibleSection
            title="Продаж електронної книги"
            badge={ebookDirty ? <ChangedBadge count={1} /> : undefined}
          >
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3 rounded-lg bg-gray-50 p-3">
              <div className="space-y-1">
                <Label htmlFor="royaltyEbook" className="block text-xs font-medium text-gray-600">
                  Ваш гонорар за електронний примірник
                </Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    id="royaltyEbook"
                    type="number"
                    step="0.01"
                    min="0"
                    value={royaltyEbook}
                    onChange={(e) => setRoyaltyEbookDirty(e.target.value)}
                    placeholder="напр. 100"
                    className={cn("h-9 w-28 bg-white", ebookDirty && "border-amber-400")}
                  />
                  <span className="text-xs text-gray-500">грн / примірник</span>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Застосовується до всіх магазинів нижче — ціну для читача в кожному порахує платформа автоматично.
              </p>
            </div>

          <HorizontalScrollHint className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-100 hover:bg-gray-100">
                  <TableHead className="w-10" />
                  <TableHead className="w-[200px] text-xs font-bold text-gray-600">Магазин</TableHead>
                  <TableHead className="w-[140px] whitespace-nowrap text-xs font-bold text-gray-600">Ціна для читача</TableHead>
                  <TableHead className="text-xs font-bold text-gray-600">Умови</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <ChannelRow
                  icon={platform("ULIT").icon}
                  name="ULIT"
                  checked
                  locked
                  shopPrice={anchor.priceEbook !== undefined ? formatUah(anchor.priceEbook) : "—"}
                  shopPriceBold
                  conditions={
                    anchor.priceEbook === undefined ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                        <span aria-hidden>○</span>
                        Ціну ще не встановлено — книга не продаватиметься як e-book, доки не вкажете гонорар вище нуля
                      </span>
                    ) : (
                      <QuestionHint title="Як рахується ціна" className="h-4 w-4">
                        {(platform("ULIT").royaltyMin * 100).toFixed(0)}% після відрахування ПДВ, комісія платформи 30%.
                      </QuestionHint>
                    )
                  }
                />
                <ChannelRow
                  icon={platform("D2D").icon}
                  name="Draft2Digital"
                  checked={channels.includes("D2D")}
                  disabled={isKdpSelect}
                  onToggle={() => toggleChannel("D2D")}
                  shopPrice={d2dPrice}
                  conditions={
                    channels.includes("D2D") ? (
                      <div className="space-y-1">
                        <PlacedBadge />
                        <p className="text-xs text-gray-500">
                          Книга буде також опублікована у всіх магазинах-партнерах та бібліотеках{" "}
                          <strong className="text-gray-700">Draft2Digital</strong>
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">{platform("D2D").description}</span>
                    )
                  }
                />
                <ChannelRow
                  icon={platform("KDP").icon}
                  name="Amazon KDP"
                  checked={channels.includes("KDP") && !kdpEbookUnsupported}
                  disabled={kdpEbookUnsupported}
                  onToggle={() => toggleChannel("KDP")}
                  shopPrice={kdpEbookUnsupported ? "—" : kdpPrice}
                  conditions={
                    kdpEbookUnsupported ? (
                      <p className="text-xs font-medium text-amber-600">
                        Недоступно для цієї мови — Kindle приймає лише друковані видання.
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {channels.includes("KDP") && <PlacedBadge />}
                        <p className="text-xs text-gray-500">
                          Ціна на книгу може бути знижена магазином під час проведення акцій або розпродажу
                        </p>
                      </div>
                    )
                  }
                />
                <ChannelRow
                  icon={platform("GOOGLE").icon}
                  name="Google Play Books"
                  checked={channels.includes("GOOGLE")}
                  disabled={isKdpSelect}
                  onToggle={() => toggleChannel("GOOGLE")}
                  shopPrice="—"
                  conditions={
                    <div className="space-y-1">
                      {channels.includes("GOOGLE") && <PlacedBadge />}
                      <p className="text-xs text-gray-500">
                        Ціну встановлює магазин. Роялті не регулюється автором.
                      </p>
                    </div>
                  }
                />
                <ChannelRow
                  icon="🔶"
                  name="Amazon KDP Select"
                  checked={isKdpSelect}
                  disabled
                  shopPrice="—"
                  conditions={
                    <div className="space-y-1.5">
                      <span className="text-xs text-gray-500">
                        Недоступно: ексклюзивність 90 днів конфліктує з Draft2Digital і Google Play.
                      </span>
                      <p className="text-xs text-blue-700">{KDP_SELECT_DISCOUNT_HINT}</p>
                      <KdpSelectPanel bookId={id} bookStatus={book.status ?? ""} />
                    </div>
                  }
                />
              </TableBody>
            </Table>
          </HorizontalScrollHint>
          </div>
          </CollapsibleSection>
      </Card>

      {/* ── Продаж друкованої книги ──────────────────────────────────── */}
      <Card className={cn("border border-gray-300 p-6 shadow-sm", priceCardRejected && "border-2 border-red-400", printDirty && !priceCardRejected && "border-2 border-amber-400")}>
          <CollapsibleSection
            title="Друкована книга"
            description="Безкоштовно для автора. Друк оплачує читач, купуючи книгу в магазині."
            badge={printDirty ? <ChangedBadge count={1} label="поле → 4 ціни" /> : undefined}
          >
          <div className="space-y-4">

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-[13px] font-medium text-gray-600">
              Формат: {formatLabel}
            </span>
            {pageCount != null && (
              <span className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-[13px] font-medium text-gray-600">
                {pageCount} сторінок
              </span>
            )}
            <span className="text-xs text-gray-400">Змінюються у «Вихідних даних» / «Рукописі»</span>
          </div>

          {!cost ? (
            <div className="space-y-1.5 rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
              {printCost?.status === "NO_SETTINGS" ? (
                <p>Собівартість друку ще не налаштована адміном.</p>
              ) : fileSectionDone ? (
                <p>Рукопис завантажено, але кількість друкованих сторінок ще не визначена. Відкрийте «Передперегляд книги».</p>
              ) : (
                <p>Завантажте рукопис (.docx) у розділі «Рукопис», щоб побачити собівартість виготовлення й порахувати ціну.</p>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-3 rounded-lg bg-gray-50 p-3">
                <div className="space-y-1">
                  <Label htmlFor="royaltyPrint" className="block text-xs font-medium text-gray-600">
                    Ваш гонорар за друкований примірник
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      id="royaltyPrint"
                      type="number"
                      step="0.01"
                      min="0"
                      value={royaltyPrint}
                      onChange={(e) => setRoyaltyPrintDirty(e.target.value)}
                      placeholder="напр. 150"
                      className={cn("h-9 w-28 bg-white", printDirty && "border-amber-400")}
                    />
                    <span className="text-xs text-gray-500">грн / примірник, понад собівартість — один для всіх 4 варіантів друку</span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-500">
                Ціна для читача = собівартість варіанту + ваш гонорар + комісія 30%.
              </p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-gray-500">Кольоровий блок</p>
                  <PriceTile label="М'яка обкладинка" price={printMatrix?.colorSoft} dirty={printDirty} />
                  <PriceTile label="Тверда обкладинка" price={printMatrix?.colorHard} dirty={printDirty} />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-gray-500">Ч/Б блок</p>
                  <PriceTile label="М'яка обкладинка" price={printMatrix?.bwSoft} dirty={printDirty} />
                  <PriceTile label="Тверда обкладинка" price={printMatrix?.bwHard} dirty={printDirty} />
                </div>
              </div>

              <HorizontalScrollHint className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-100 hover:bg-gray-100">
                      <TableHead className="w-10" />
                      <TableHead className="w-[200px] text-xs font-bold text-gray-600">Магазин</TableHead>
                      <TableHead className="w-[160px] whitespace-nowrap text-xs font-bold text-gray-600">Ціна для читача</TableHead>
                      <TableHead className="text-xs font-bold text-gray-600">Умови</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <ChannelRow
                      icon={platform("ULIT").icon}
                      name="ULIT"
                      checked
                      locked
                      shopPrice={ulitPrintFrom !== undefined ? `4 варіанти · від ${formatUah(ulitPrintFrom)}` : "—"}
                      shopPriceBold
                      conditions={<span className="text-xs text-gray-500">Ціни варіантів — у матриці вище.</span>}
                    />
                    <ChannelRow
                      icon={platform("KDP").icon}
                      name="Amazon KDP"
                      checked={channels.includes("KDP")}
                      onToggle={() => toggleChannel("KDP")}
                      shopPrice={
                        <span>
                          {kdpPrintPrice}{" "}
                          <span className="text-xs text-amber-600">розраховується автоматично</span>
                        </span>
                      }
                      conditions={
                        <div className="space-y-1">
                          {channels.includes("KDP") && <PlacedBadge />}
                          <p className="text-xs text-gray-500">
                            Друк на вимогу. Роялті KDP — фіксовано 60% ціни мінус собівартість друку в KDP.
                          </p>
                        </div>
                      }
                    />
                  </TableBody>
                </Table>
              </HorizontalScrollHint>
            </>
          )}
          </div>
          </CollapsibleSection>
      </Card>

      {/* ── Знижка в ULIT ────────────────────────────────────────────── */}
      <Card className={cn("border border-gray-300 p-6 shadow-sm", discountDirty && "border-2 border-amber-400")}>
        <CollapsibleSection
          title="Знижка в ULIT"
          description="Знижки у власному магазині ULIT діють одразу, без модерації."
          badge={discountDirty ? <ChangedBadge count={1} /> : undefined}
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-3 rounded-lg bg-gray-50 p-3">
              <div className="space-y-1">
                <Label htmlFor="discountPercent" className="block text-xs font-medium text-gray-600">Знижка</Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    id="discountPercent"
                    type="number"
                    step="1"
                    min={MIN_DISCOUNT_PERCENT}
                    max={MAX_DISCOUNT_PERCENT}
                    value={discountPercent}
                    onChange={(e) => setDiscountPercentDirty(e.target.value)}
                    placeholder="напр. 20"
                    className={cn("h-9 w-20 bg-white", discountDirty && "border-amber-400")}
                  />
                  <span className="text-xs text-gray-500">% ({MIN_DISCOUNT_PERCENT}–{MAX_DISCOUNT_PERCENT})</span>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="discountStartsAt" className="block text-xs font-medium text-gray-600">Початок (необов&apos;язково)</Label>
                <Input
                  id="discountStartsAt"
                  type="date"
                  value={discountStartsAt}
                  onChange={(e) => setDiscountStartsAtDirty(e.target.value)}
                  className={cn("h-9 bg-white", discountDirty && "border-amber-400")}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="discountEndsAt" className="block text-xs font-medium text-gray-600">До (обов&apos;язково зі знижкою)</Label>
                <Input
                  id="discountEndsAt"
                  type="date"
                  min={tomorrowDateInputValue()}
                  value={discountEndsAt}
                  onChange={(e) => setDiscountEndsAtDirty(e.target.value)}
                  className={cn("h-9 bg-white", discountDirty && "border-amber-400")}
                />
              </div>
            </div>

            {showDiscountPreview && (
              <div className="space-y-1.5 rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-900">
                <p className="font-semibold">Приклад з обраною знижкою ({previewPercent}%):</p>
                {anchor.priceEbook !== undefined && (
                  <p>
                    Е-книга: <s className="text-gray-500">{formatUah(anchor.priceEbook)}</s>{" "}
                    <strong>{formatUah(discountedPrice(anchor.priceEbook, discountPreviewFields))}</strong> — ваш
                    гонорар {formatUah(royaltyEbookNum ?? 0)} →{" "}
                    <strong>{formatUah(royaltyFromPrice(discountedPrice(anchor.priceEbook, discountPreviewFields), 0, platform("ULIT").royaltyMin))}</strong>
                  </p>
                )}
                {printMatrix && cost && (
                  <p>
                    Друк (кольоровий, м&apos;яка): <s className="text-gray-500">{formatUah(printMatrix.colorSoft)}</s>{" "}
                    <strong>{formatUah(discountedPrice(printMatrix.colorSoft, discountPreviewFields))}</strong> — ваш
                    гонорар {formatUah(royaltyPrintNum ?? 0)} →{" "}
                    <strong>
                      {formatUah(
                        royaltyFromPrice(discountedPrice(printMatrix.colorSoft, discountPreviewFields), cost.softcoverCost, platform("ULIT").royaltyMin)
                      )}
                    </strong>
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5 text-xs text-gray-500">
              <p className="inline-flex items-center gap-1">
                <span aria-hidden>ⓘ</span>
                Знижки діють лише в магазині ULIT і не передаються в Amazon, Draft2Digital, Google Play.
              </p>
              <p className="text-blue-700">{KDP_SELECT_DISCOUNT_HINT}</p>
            </div>
          </div>
        </CollapsibleSection>
      </Card>

      {/* Deliberately NOT inside a Card -- conclusion of the blocks above. */}
      {(channels.includes("ULIT") || externalRows.length > 0) && (
        <div className="space-y-3 px-1">
          <h3 className="text-base font-semibold text-gray-900">Що відбудеться після внесення змін:</h3>
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <div className="flex items-center gap-3">
              <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded border bg-gray-50 px-2 py-1.5 text-[13px] font-bold text-gray-900">
                {platform("ULIT").icon} ULIT
              </span>
              <p className="text-[13px] text-gray-600">Ціна на сайті оновиться одразу після збереження.</p>
            </div>
            {externalRows.map((r) => {
              const s = EXTERNAL_STATUS_LABEL[r.status ?? "NOT_SENT"] ?? EXTERNAL_STATUS_LABEL.NOT_SENT;
              return (
                <div key={r.key} className="flex items-center gap-3">
                  <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded border bg-gray-50 px-2 py-1.5 text-[13px] font-bold text-gray-900">
                    {platform(r.key.toUpperCase()).icon} {r.label}
                  </span>
                  <p className="text-[13px] text-gray-600">
                    Зміни тут не надсилаються автоматично — статус:{" "}
                    <Badge className={cn("rounded-sm px-1.5 py-0.5 text-[11px]", s.className)}>{s.label}</Badge>
                    {r.sentAt && <span className="ml-1">від {fmtDate(r.sentAt)}</span>}. Адміністрація оновить дані вручну.
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {formatsError && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{formatsError}</div>}
    </div>
  );
}

function PriceTile({ label, price, dirty }: { label: string; price: number | undefined; dirty: boolean }) {
  return (
    <div className={cn("rounded-md border bg-white p-2.5", dirty && "border-amber-400")}>
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-gray-900">{price !== undefined ? formatUah(price) : "—"}</p>
    </div>
  );
}

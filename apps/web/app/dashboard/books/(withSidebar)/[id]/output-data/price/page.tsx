"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { OutputDataSectionHeading } from "@/components/dashboard/OutputDataSectionHeading";
import { CollapsibleSection } from "@/components/dashboard/CollapsibleSection";
import {
  computeAnchorPrices,
  computeBwPrices,
  formatUah,
  parseRoyalty,
  suggestedPriceRange,
  type PrintCost,
} from "@/components/books/FormatsAndDistribution";
import { KdpSelectPanel } from "@/components/books/KdpSelectPanel";
import { Badge } from "@/components/ui/badge";
import { SaveActionButton } from "@/components/ui/SaveActionButton";
import { HorizontalScrollHint } from "@/components/ui/HorizontalScrollHint";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBook } from "@/hooks/useBook";
import { useApi } from "@/hooks/useApi";
import { DISTRIBUTION_PLATFORMS, KDP_EBOOK_UNSUPPORTED_LANGUAGES } from "@/lib/distributionPlatforms";
import { DEFAULT_PLATFORM_FEE_PERCENT } from "shared-types";
import { getUnresolvedRejectionLines } from "@/lib/rejectedBlocks";
import { SECTION_LABELS } from "@/lib/outputDataSections";
import { cn } from "@/lib/utils";
import {
  PRINT_FORMATS,
  resolveBookPrintFormat,
  isPublishStepComplete,
  CHANNEL_PRICING_KEYS,
  type ChannelPricingKey,
  type ChannelPricing,
} from "shared-types";

interface PriceBook {
  status?: string | null;
  language: string;
  printFormatKey?: string | null;
  printWidthMm?: number | null;
  printHeightMm?: number | null;
  printPageCount?: number | null;
  pageCount?: number | null;
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
  channelPricing?: ChannelPricing | null;
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

function fmtDate(d?: string | null): string {
  return d ? new Date(d).toLocaleDateString("uk-UA") : "";
}

function platform(key: string) {
  return DISTRIBUTION_PLATFORMS.find((p) => p.key === key)!;
}

// One row of either table -- checkbox / store chip / your price-or-royalty
// input / computed shop price / conditions. A row with no `input` (Google
// Play Books, KDP Select) shows shopPrice as plain informational text
// instead.
function ChannelRow({
  icon,
  name,
  checked,
  locked,
  disabled,
  onToggle,
  input,
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
  input?: { value: string; onChange: (v: string) => void; unit?: string };
  shopPrice: string;
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
      <TableCell>
        {input ? (
          <div className="flex w-fit items-center gap-1.5 rounded border bg-white px-2 py-1.5 whitespace-nowrap">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={input.value}
              onChange={(e) => input.onChange(e.target.value)}
              placeholder="—"
              className="h-5 w-14 border-0 p-0 text-[13px] font-semibold shadow-none focus-visible:ring-0"
            />
            <span className="text-xs text-gray-400">{input.unit ?? "грн"}</span>
          </div>
        ) : (
          <span className="text-sm text-gray-400">—</span>
        )}
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
  const { apiFetch, token } = useApi();
  const { book, setBook, loading } = useBook<PriceBook>(id);

  const [printCost, setPrintCost] = useState<PrintCost | null>(null);
  const [channels, setChannels] = useState<string[]>(["ULIT"]);
  const [royaltyEbook, setRoyaltyEbook] = useState("");
  const [royaltyPrint, setRoyaltyPrint] = useState("");
  const [pricePrintBw, setPricePrintBw] = useState("");
  // Per-EXTERNAL-channel advisory royalty (channelPricing) -- string inputs,
  // same pattern as royaltyEbook/royaltyPrint above, keyed by
  // ChannelPricingKey (D2D/KDP/GOOGLE ebook, KDP_PRINT print).
  const [channelRoyalty, setChannelRoyalty] = useState<Record<ChannelPricingKey, string>>({
    D2D: "",
    KDP: "",
    GOOGLE: "",
    KDP_PRINT: "",
  });
  // Print specs toggles -- which combination the print table's price column
  // currently shows/edits. Color only actually branches ULIT's own price
  // (pricePrint* vs pricePrintBw* -- the only place a B&W/colour distinction
  // exists in the schema); KDP_PRINT's own advisory number stays the same
  // regardless, same simplification FormatsAndDistribution.tsx's own
  // "чорно-білий друк (опційно)" sub-block already made.
  const [printColorMode, setPrintColorMode] = useState<"color" | "bw">("color");
  const [printBinding, setPrintBinding] = useState<"softcover" | "hardcover">("softcover");
  const [formatsSaving, setFormatsSaving] = useState(false);
  const [formatsSaved, setFormatsSaved] = useState(false);
  const [formatsDirty, setFormatsDirty] = useState(false);
  const [formatsError, setFormatsError] = useState("");

  function markFormatsDirty() {
    setFormatsDirty(true);
    setFormatsSaved(false);
  }

  useEffect(() => {
    // Found live (Playwright, direct URL navigation): missing `token` from
    // this effect's deps let it fire on mount before next-auth's session
    // had actually hydrated on a fresh page load (a raw `useState`/
    // `useSession` read is undefined for a beat before the JWT resolves --
    // most navigations here come from the sidebar with the session already
    // warm, which is why this wasn't noticed sooner). apiFetch's own
    // withTokenRetry (useApi.ts) only retries a 401 when the ORIGINAL
    // attempt already had a token to refresh -- an attempt made with
    // token=undefined gets no retry at all, so this fired with no
    // Authorization header, got a bare 401, and silently left printCost
    // null forever (shown to the author as "кількість друкованих сторінок
    // ще не визначена", even though it genuinely was).
    if (!id || !token) return;
    apiFetch<PrintCost>(`/api/books/${id}/print-cost`).then(setPrintCost).catch(() => {});
  }, [id, token, apiFetch]);

  // Same "hydrate once" guard as the Інформація page -- useBook() silently
  // refetches in the background on tab focus, which would otherwise clobber
  // unsaved royalty/channel edits with whatever's still on the server.
  const bookHydratedRef = useRef(false);
  useEffect(() => {
    if (!book || bookHydratedRef.current) return;
    bookHydratedRef.current = true;
    setChannels(Array.isArray(book.distributionChannels) && book.distributionChannels.length > 0 ? book.distributionChannels : ["ULIT"]);
    setRoyaltyEbook(book.desiredRoyaltyAmount ? String(Number(book.desiredRoyaltyAmount)) : "");
    setRoyaltyPrint(book.desiredRoyaltyAmountPrint ? String(Number(book.desiredRoyaltyAmountPrint)) : "");
    setPricePrintBw(book.pricePrintBw ? String(Number(book.pricePrintBw)) : "");
    const cp = book.channelPricing ?? {};
    setChannelRoyalty({
      D2D: cp.D2D?.royalty != null ? String(cp.D2D.royalty) : "",
      KDP: cp.KDP?.royalty != null ? String(cp.KDP.royalty) : "",
      GOOGLE: cp.GOOGLE?.royalty != null ? String(cp.GOOGLE.royalty) : "",
      KDP_PRINT: cp.KDP_PRINT?.royalty != null ? String(cp.KDP_PRINT.royalty) : "",
    });
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
  function setPricePrintBwDirty(v: string) {
    markFormatsDirty();
    setPricePrintBw(v);
  }
  function setChannelRoyaltyDirty(key: ChannelPricingKey, v: string) {
    markFormatsDirty();
    setChannelRoyalty((p) => ({ ...p, [key]: v }));
  }

  async function saveFormatsAndDistribution() {
    setFormatsError("");
    setFormatsSaving(true);
    try {
      const anchor = computeAnchorPrices(printCost, royaltyEbook, royaltyPrint);
      const bw = computeBwPrices(printCost, pricePrintBw);
      const channelPricing: ChannelPricing = {};
      for (const key of CHANNEL_PRICING_KEYS) {
        const royalty = parseRoyalty(channelRoyalty[key]);
        if (royalty !== undefined) channelPricing[key] = { royalty };
      }
      const { book: updated } = await apiFetch<{ book: PriceBook }>(`/api/books/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          desiredRoyaltyAmount: anchor.priceEbook !== undefined ? Number(royaltyEbook.replace(",", ".")) : null,
          desiredRoyaltyAmountPrint: anchor.pricePrint !== undefined ? Number(royaltyPrint.replace(",", ".")) : null,
          priceEbook: anchor.priceEbook ?? null,
          pricePrint: anchor.pricePrint ?? null,
          pricePrintHardcover: anchor.pricePrintHardcover ?? null,
          pricePrintBw: bw.pricePrintBw ?? null,
          pricePrintHardcoverBw: bw.pricePrintHardcoverBw ?? null,
          channelPricing: Object.keys(channelPricing).length > 0 ? channelPricing : null,
        }),
      });
      setBook(updated);
      await apiFetch(`/api/books/${id}/distribution`, {
        method: "PATCH",
        body: JSON.stringify({ distributionChannels: channels }),
      });
      setFormatsSaved(true);
      setFormatsDirty(false);
      // Same fix as output-data/page.tsx's onSubmitInfo -- layout.tsx's top
      // nav pills read their own separate useBook(id) instance and only
      // learn a save happened via this event.
      window.dispatchEvent(new Event("ulit:books-changed"));
    } catch (e: any) {
      setFormatsError(e.message || "Помилка збереження");
    } finally {
      setFormatsSaving(false);
    }
  }

  if (loading || !book) {
    return <div className="h-96 bg-gray-200 rounded-xl animate-pulse" />;
  }

  const fileSectionDone = isPublishStepComplete("file", book);
  const priceSectionDone = isPublishStepComplete("price", book);
  const unresolvedRejectionLines = getUnresolvedRejectionLines(book);
  const priceCardRejected = unresolvedRejectionLines.some((l) => l.category === "price");

  const displayFormat = resolveBookPrintFormat(book);
  const formatLabel = `${displayFormat.widthMm}×${displayFormat.heightMm}мм (${PRINT_FORMATS[displayFormat.key as keyof typeof PRINT_FORMATS]?.label ?? "Стандартний"})`;
  const pageCount = book.printPageCount ?? book.pageCount;

  const cost = printCost?.status === "DONE" ? printCost : null;
  const royaltyEbookNum = parseRoyalty(royaltyEbook);
  const royaltyPrintNum = parseRoyalty(royaltyPrint);
  const anchor = computeAnchorPrices(printCost, royaltyEbook, royaltyPrint);
  const bw = computeBwPrices(printCost, pricePrintBw);
  const kdpEbookUnsupported = KDP_EBOOK_UNSUPPORTED_LANGUAGES.includes(book.language);
  const isKdpSelect = channels.includes("KDP") && !channels.includes("D2D") && !channels.includes("GOOGLE");

  // ── Електронна книга: shop price per row ──────────────────────────────
  const d2dRoyalty = parseRoyalty(channelRoyalty.D2D);
  const d2dPrice = d2dRoyalty !== undefined ? formatUah(d2dRoyalty / platform("D2D").royaltyMin) : "—";
  const kdpRoyalty = parseRoyalty(channelRoyalty.KDP);
  const kdpRange = kdpRoyalty !== undefined ? suggestedPriceRange(0, kdpRoyalty, platform("KDP").royaltyMin, platform("KDP").royaltyMax) : null;
  const kdpPrice = kdpRange ? `від ${formatUah(kdpRange.min)}` : "—";

  // ── Друкована книга: shop price for ULIT depends on both toggles ──────
  const ulitPrintPrice =
    printColorMode === "color"
      ? printBinding === "softcover"
        ? anchor.pricePrint
        : anchor.pricePrintHardcover
      : printBinding === "softcover"
        ? bw.pricePrintBw
        : bw.pricePrintHardcoverBw;
  const printCostBasis = cost ? (printBinding === "softcover" ? cost.softcoverCost : cost.hardcoverCost) : undefined;
  const kdpPrintRoyalty = parseRoyalty(channelRoyalty.KDP_PRINT);
  const kdpPrintRange =
    kdpPrintRoyalty !== undefined && printCostBasis !== undefined
      ? suggestedPriceRange(printCostBasis, kdpPrintRoyalty, platform("KDP").royaltyMin, platform("KDP").royaltyMax)
      : null;
  const kdpPrintPrice = kdpPrintRange ? `від ${formatUah(kdpPrintRange.min)}` : "—";

  const externalRows = (
    [
      { key: "d2d", label: "Draft2Digital", status: book.d2dStatus, sentAt: book.d2dSentAt },
      { key: "kdp", label: "Amazon KDP", status: book.kdpStatus, sentAt: book.kdpSentAt },
      { key: "google", label: "Google Play Books", status: book.googleStatus, sentAt: book.googleSentAt },
    ] as const
  ).filter((r) => channels.includes(r.key.toUpperCase()));

  return (
    <div className="space-y-3">
      <OutputDataSectionHeading label={SECTION_LABELS.price} done={priceSectionDone && !priceCardRejected} />

      {/* Own bordered block, separate from "Продаж друкованої книги" below
          -- matches Figma, which draws these as two distinct boxes, not one
          shared card with an internal divider. */}
      <Card className={cn("border border-gray-300 p-6 shadow-sm", priceCardRejected && "border-2 border-red-400")}>
          <CollapsibleSection title="Продаж електронної книги">
          <div className="space-y-4">
          <HorizontalScrollHint className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-100 hover:bg-gray-100">
                  <TableHead className="w-10" />
                  <TableHead className="w-[200px] text-xs font-bold text-gray-600">Де буде викладена</TableHead>
                  <TableHead className="w-[220px] text-xs font-bold text-gray-600">Ваша ціна / роялті</TableHead>
                  <TableHead className="w-[140px] whitespace-nowrap text-xs font-bold text-gray-600">Ціна за книгу в магазині</TableHead>
                  <TableHead className="text-xs font-bold text-gray-600">Умови розміщення</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <ChannelRow
                  icon={platform("ULIT").icon}
                  name="ULIT"
                  checked
                  locked
                  input={{ value: royaltyEbook, onChange: setRoyaltyEbookDirty }}
                  shopPrice={anchor.priceEbook !== undefined ? formatUah(anchor.priceEbook) : "—"}
                  shopPriceBold
                  conditions={
                    anchor.priceEbook === undefined ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                        <span aria-hidden>○</span>
                        Ціну ще не встановлено — книга не продаватиметься як e-book, доки не вкажете гонорар вище нуля
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">
                        Роялті складає {(platform("ULIT").royaltyMin * 100).toFixed(0)}% від ціни після відрахування ПДВ.
                        Ціна для покупця (комісія {DEFAULT_PLATFORM_FEE_PERCENT}%): <strong className="text-gray-900">{formatUah(anchor.priceEbook)}</strong> —
                        саме ця ціна й буде збережена. На інших каналах кінцева ціна відрізняється через їхню власну комісію.
                      </span>
                    )
                  }
                />
                <ChannelRow
                  icon={platform("D2D").icon}
                  name="Draft2Digital"
                  checked={channels.includes("D2D")}
                  disabled={isKdpSelect}
                  onToggle={() => toggleChannel("D2D")}
                  input={{ value: channelRoyalty.D2D, onChange: (v) => setChannelRoyaltyDirty("D2D", v) }}
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
                  checked={channels.includes("KDP")}
                  onToggle={() => toggleChannel("KDP")}
                  input={{ value: channelRoyalty.KDP, onChange: (v) => setChannelRoyaltyDirty("KDP", v) }}
                  shopPrice={kdpPrice}
                  conditions={
                    <div className="space-y-1">
                      {channels.includes("KDP") && <PlacedBadge />}
                      <p className="text-xs text-gray-500">
                        Ціна на книгу може бути знижена магазином під час проведення акцій або розпродажу
                      </p>
                      {kdpEbookUnsupported && (
                        <p className="text-xs font-medium text-amber-600">
                          Amazon KDP для цієї мови приймає лише друковані видання — електронна книга на Kindle видана не буде.
                        </p>
                      )}
                    </div>
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
                        Роялті не регулюється автором. Відрахування залежать від прочитань книги у Google Play Books.
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
                        Ексклюзивність 90 днів: Draft2Digital і Google Play Books будуть заблоковані, скасувати не можна до
                        кінця терміну.
                      </span>
                      {/* Post-publish strategy switch itself lives in
                          KdpSelectPanel (self-gated on book.status ===
                          "PUBLISHED", renders null before that) -- moved
                          here from its own separate Card at the bottom of
                          the page so the actual "Зареєструватись" button
                          sits right next to the row it controls, not in an
                          unrelated block below both tables. */}
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
      <Card className={cn("border border-gray-300 p-6 shadow-sm", priceCardRejected && "border-2 border-red-400")}>
          <CollapsibleSection
            title="Продаж друкованої книги"
            description="Безкоштовно для автора. Друк оплачує читач, купуючи книгу в магазині."
          >
          <div className="space-y-4">

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPrintColorMode("bw")}
              className={cn(
                "rounded-md border px-3 py-2 text-[13px] font-medium transition-colors",
                printColorMode === "bw" ? "border-gray-300 bg-gray-200 text-gray-700" : "border-gray-200 bg-white text-gray-500"
              )}
            >
              Чорно-білий внутрішній блок
            </button>
            <button
              type="button"
              onClick={() => setPrintColorMode("color")}
              className={cn(
                "rounded-md border px-3 py-2 text-[13px] font-medium transition-colors",
                printColorMode === "color" ? "border-gray-300 bg-gray-200 text-gray-700" : "border-gray-200 bg-white text-gray-500"
              )}
            >
              Кольоровий внутрішній блок
            </button>
            <button
              type="button"
              onClick={() => setPrintBinding("softcover")}
              className={cn(
                "rounded-md border px-3 py-2 text-[13px] font-medium transition-colors",
                printBinding === "softcover" ? "border-gray-300 bg-gray-200 text-gray-700" : "border-gray-200 bg-white text-gray-500"
              )}
            >
              М&apos;яка обкладинка
            </button>
            <button
              type="button"
              onClick={() => setPrintBinding("hardcover")}
              className={cn(
                "rounded-md border px-3 py-2 text-[13px] font-medium transition-colors",
                printBinding === "hardcover" ? "border-gray-300 bg-gray-200 text-gray-700" : "border-gray-200 bg-white text-gray-500"
              )}
            >
              Тверда обкладинка
            </button>
            <span className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-[13px] font-medium text-gray-600">
              Формат {formatLabel}
            </span>
            {pageCount != null && (
              <span className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-[13px] font-medium text-gray-600">
                {pageCount} сторінок
              </span>
            )}
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
                  <label
                    htmlFor={printColorMode === "color" ? "royaltyPrint" : "pricePrintBw"}
                    className="block text-xs font-medium text-gray-600"
                  >
                    {printColorMode === "color" ? "Ваш бажаний гонорар за примірник (ULIT)" : "Пряма ціна за примірник, ч/б (ULIT)"}
                  </label>
                  {printColorMode === "color" ? (
                    <div className="flex items-center gap-1.5">
                      <Input
                        id="royaltyPrint"
                        type="number"
                        step="0.01"
                        min="0"
                        value={royaltyPrint}
                        onChange={(e) => setRoyaltyPrintDirty(e.target.value)}
                        placeholder="напр. 50"
                        className="h-9 w-28 bg-white"
                      />
                      <span className="text-xs text-gray-500">грн / примірник, понад собівартість</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Input
                        id="pricePrintBw"
                        type="number"
                        step="0.01"
                        min="0"
                        value={pricePrintBw}
                        onChange={(e) => setPricePrintBwDirty(e.target.value)}
                        placeholder="149.99"
                        className="h-9 w-28 bg-white"
                      />
                      <span className="text-xs text-gray-500">грн / примірник (м&apos;яка), пряма ціна</span>
                    </div>
                  )}
                </div>
                {ulitPrintPrice !== undefined && (
                  <p className="text-xs text-gray-500">
                    Ціна для покупця в ULIT ({printBinding === "softcover" ? "м'яка" : "тверда"} обкладинка, комісія {DEFAULT_PLATFORM_FEE_PERCENT}%):{" "}
                    <strong className="text-gray-900">{formatUah(ulitPrintPrice)}</strong>
                  </p>
                )}
              </div>

              <HorizontalScrollHint className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-100 hover:bg-gray-100">
                      <TableHead className="w-10" />
                      <TableHead className="w-[200px] text-xs font-bold text-gray-600">Де буде викладена</TableHead>
                      <TableHead className="w-[220px] text-xs font-bold text-gray-600">Роялті / ціна (ваша ставка)</TableHead>
                      <TableHead className="w-[140px] whitespace-nowrap text-xs font-bold text-gray-600">Ціна в магазині</TableHead>
                      <TableHead className="text-xs font-bold text-gray-600">Умови розміщення</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <ChannelRow
                      icon={platform("ULIT").icon}
                      name="ULIT"
                      checked
                      locked
                      input={{
                        value: printColorMode === "color" ? royaltyPrint : pricePrintBw,
                        onChange: printColorMode === "color" ? setRoyaltyPrintDirty : setPricePrintBwDirty,
                      }}
                      shopPrice={ulitPrintPrice !== undefined ? formatUah(ulitPrintPrice) : "—"}
                      shopPriceBold
                      conditions={
                        ulitPrintPrice === undefined ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                            <span aria-hidden>○</span>
                            Ціну ще не встановлено для цього поєднання ({printColorMode === "color" ? "кольоровий" : "ч/б"},{" "}
                            {printBinding === "softcover" ? "м'яка" : "тверда"}) — вкажіть {printColorMode === "color" ? "гонорар" : "пряму ціну"} вище нуля
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500">
                            Собівартість ({printBinding === "softcover" ? "м'яка" : "тверда"}): {printCostBasis?.toFixed(2)} грн + Ваш
                            гонорар + комісія платформи = ціна для покупця.
                          </span>
                        )
                      }
                    />
                    <ChannelRow
                      icon={platform("KDP").icon}
                      name="Amazon KDP"
                      checked={channels.includes("KDP")}
                      onToggle={() => toggleChannel("KDP")}
                      input={{ value: channelRoyalty.KDP_PRINT, onChange: (v) => setChannelRoyaltyDirty("KDP_PRINT", v) }}
                      shopPrice={kdpPrintPrice}
                      conditions={
                        <div className="space-y-1">
                          {channels.includes("KDP") && <PlacedBadge />}
                          <p className="text-xs text-gray-500">
                            Книга буде продаватися за технологією «Друк на вимогу». Ціна до знижок у магазині.
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

      {/* Deliberately NOT inside a Card -- this is the conclusion of both
          blocks above (per Figma), not a block of its own. */}
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
      <SaveActionButton
        state={formatsSaving ? "saving" : formatsSaved && !formatsDirty ? "saved" : "idle"}
        idleLabel="Зберегти"
        onClick={saveFormatsAndDistribution}
      />
    </div>
  );
}

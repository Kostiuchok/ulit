"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { OutputDataSectionHeading } from "@/components/dashboard/OutputDataSectionHeading";
import { FormatsAndDistribution, computeAnchorPrices, computeBwPrices, type PrintCost } from "@/components/books/FormatsAndDistribution";
import { KdpSelectPanel } from "@/components/books/KdpSelectPanel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useBook } from "@/hooks/useBook";
import { useApi } from "@/hooks/useApi";
import { getUnresolvedRejectionLines } from "@/lib/rejectedBlocks";
import { SECTION_LABELS } from "@/lib/outputDataSections";
import { cn } from "@/lib/utils";
import { PRINT_FORMATS, resolveBookPrintFormat, isPublishStepComplete } from "shared-types";

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
  distributionChannels?: string[] | null;
  moderationStatus?: string | null;
  moderationNote?: string | null;
  moderationReasons?: string[] | null;
  moderationCustomNote?: string | null;
  moderationFieldSnapshot?: unknown;
}

export default function OutputDataPricePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { apiFetch } = useApi();
  const { book, setBook, loading } = useBook<PriceBook>(id);

  const [printCost, setPrintCost] = useState<PrintCost | null>(null);
  const [channels, setChannels] = useState<string[]>(["ULIT"]);
  const [royaltyEbook, setRoyaltyEbook] = useState("");
  const [royaltyPrint, setRoyaltyPrint] = useState("");
  const [pricePrintBw, setPricePrintBw] = useState(""); // softcover B&W only -- hardcover B&W is derived (computeBwPrices)
  const [formatsSaving, setFormatsSaving] = useState(false);
  const [formatsSaved, setFormatsSaved] = useState(false);
  const [formatsError, setFormatsError] = useState("");

  useEffect(() => {
    if (!id) return;
    apiFetch<PrintCost>(`/api/books/${id}/print-cost`).then(setPrintCost).catch(() => {});
  }, [id]);

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
  }, [book]);

  function toggleChannel(key: string) {
    if (key === "ULIT") return;
    setChannels((prev) => (prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]));
  }

  // T-2075 -- one save action for the merged "Ціна та розповсюдження"
  // section: derives the concrete Ulit-anchored priceEbook/pricePrint/
  // pricePrintHardcover from the two royalty inputs (same helper BookWizard's
  // step 2 uses), then saves both the price PATCH and the
  // distributionChannels PATCH together -- they're one decision now, not two.
  async function saveFormatsAndDistribution() {
    setFormatsError("");
    setFormatsSaving(true);
    try {
      const anchor = computeAnchorPrices(printCost, royaltyEbook, royaltyPrint);
      const bw = computeBwPrices(printCost, pricePrintBw);
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
        }),
      });
      setBook(updated);
      await apiFetch(`/api/books/${id}/distribution`, {
        method: "PATCH",
        body: JSON.stringify({ distributionChannels: channels }),
      });
      setFormatsSaved(true);
      setTimeout(() => setFormatsSaved(false), 3000);
    } catch (e: any) {
      setFormatsError(e.message || "Помилка збереження");
    } finally {
      setFormatsSaving(false);
    }
  }

  if (loading) {
    return <div className="h-96 bg-gray-200 rounded-xl animate-pulse" />;
  }

  const fileSectionDone = isPublishStepComplete("file", book ?? {});
  const priceSectionDone = isPublishStepComplete("price", book ?? {});
  const unresolvedRejectionLines = book ? getUnresolvedRejectionLines(book) : [];
  const priceCardRejected = unresolvedRejectionLines.some((l) => l.category === "price");

  // Persisted format, not live in-progress form state from the Інформація
  // tab -- that tab's own unsaved edits aren't visible here until saved
  // (matches how every other Інформація field already behaves once split
  // across pages).
  const displayFormat = resolveBookPrintFormat(book ?? {});

  return (
    <div className="space-y-3">
      <OutputDataSectionHeading label={SECTION_LABELS.price} done={priceSectionDone && !priceCardRejected} />
      <Card className={cn("p-6 shadow-sm space-y-5", priceCardRejected && "border-2 border-red-400")}>
        <FormatsAndDistribution
          language={book?.language}
          formatLabel={`${displayFormat.widthMm}×${displayFormat.heightMm}мм (${PRINT_FORMATS[displayFormat.key as keyof typeof PRINT_FORMATS]?.label ?? "Стандартний"})`}
          pageCount={book?.printPageCount ?? book?.pageCount}
          printCost={printCost}
          channels={channels}
          onToggleChannel={toggleChannel}
          royaltyEbook={royaltyEbook}
          onRoyaltyEbookChange={setRoyaltyEbook}
          royaltyPrint={royaltyPrint}
          onRoyaltyPrintChange={setRoyaltyPrint}
          pricePrintBw={pricePrintBw}
          onPricePrintBwChange={setPricePrintBw}
          hasManuscript={fileSectionDone}
          bookId={id}
          onUploadManuscript={() => router.push(`/dashboard/books/${id}/output-data/file`)}
        />

        {formatsError && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{formatsError}</div>
        )}
        {formatsSaved && (
          <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">✓ Збережено</div>
        )}
        <Button onClick={saveFormatsAndDistribution} loading={formatsSaving}>
          Зберегти зміни
        </Button>
      </Card>

      {book?.status === "PUBLISHED" && (
        <Card className="p-6 shadow-sm">
          <KdpSelectPanel bookId={id} bookStatus={book.status} />
        </Card>
      )}
    </div>
  );
}

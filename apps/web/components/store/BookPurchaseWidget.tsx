"use client";

import { useState } from "react";
import { TabletCoverFrame } from "../books/TabletCoverFrame";
import { PrintedCoverFrame } from "../books/PrintedCoverFrame";
import { AddToCartButton } from "./AddToCartButton";
import { cn } from "../../lib/utils";

interface Props {
  bookId: string;
  title: string;
  author: string;
  coverUrl?: string | null;
  priceEbook?: number | null;
  pricePrint?: number | null;
  pricePrintHardcover?: number | null;
  pricePrintBw?: number | null;
  pricePrintHardcoverBw?: number | null;
}

const BINDING_LABEL: Record<"softcover" | "hardcover", string> = {
  softcover: "м'яка обкладинка",
  hardcover: "тверда обкладинка",
};

// Single purchase flow replacing three separate price cards (ebook +
// softcover + hardcover, each with its own "Додати в кошик") -- one format
// choice (thumbnail pills), one binding/color choice when print is picked,
// one price, one cart button.
export function BookPurchaseWidget({
  bookId,
  title,
  author,
  coverUrl,
  priceEbook,
  pricePrint,
  pricePrintHardcover,
  pricePrintBw,
  pricePrintHardcoverBw,
}: Props) {
  const hasEbook = priceEbook != null;
  const hasSoftcover = pricePrint != null || pricePrintBw != null;
  const hasHardcover = pricePrintHardcover != null || pricePrintHardcoverBw != null;
  const hasPrint = hasSoftcover || hasHardcover;

  const [format, setFormat] = useState<"ebook" | "print">(hasEbook ? "ebook" : "print");
  const [binding, setBinding] = useState<"softcover" | "hardcover">(hasSoftcover ? "softcover" : "hardcover");
  const [colorMode, setColorMode] = useState<"color" | "bw">("color");

  if (!hasEbook && !hasPrint) return null;

  if (format === "ebook") {
    return (
      <div className="space-y-4">
        <FormatPills
          coverUrl={coverUrl}
          hasEbook={hasEbook}
          hasPrint={hasPrint}
          format={format}
          onChange={setFormat}
        />
        <PriceAndCta
          price={priceEbook!}
          label="Додати в кошик"
          cartProps={{
            bookId,
            format: "EBOOK",
            price: priceEbook!,
            title,
            author,
            coverUrl,
            formatLabel: "Електронна книга (EPUB + FB2 + MOBI)",
          }}
        />
      </div>
    );
  }

  // format === "print"
  const effectiveBinding = binding === "softcover" && !hasSoftcover ? "hardcover" : binding === "hardcover" && !hasHardcover ? "softcover" : binding;
  const colorPrice = effectiveBinding === "softcover" ? pricePrint : pricePrintHardcover;
  const bwPrice = effectiveBinding === "softcover" ? pricePrintBw : pricePrintHardcoverBw;
  const hasBothColors = colorPrice != null && bwPrice != null;
  const effectiveColorMode = !hasBothColors ? (colorPrice != null ? "color" : "bw") : colorMode;
  const price = effectiveColorMode === "color" ? colorPrice : bwPrice;

  const cartFormat =
    effectiveBinding === "softcover"
      ? effectiveColorMode === "color"
        ? "PRINT_SOFTCOVER"
        : "PRINT_SOFTCOVER_BW"
      : effectiveColorMode === "color"
      ? "PRINT_HARDCOVER"
      : "PRINT_HARDCOVER_BW";

  const formatLabel = `Друкована версія, ${BINDING_LABEL[effectiveBinding]}, ${effectiveColorMode === "color" ? "кольоровий" : "чорно-білий"} друк (PDF)`;

  return (
    <div className="space-y-4">
      <FormatPills coverUrl={coverUrl} hasEbook={hasEbook} hasPrint={hasPrint} format={format} onChange={setFormat} />

      {hasSoftcover && hasHardcover && (
        <div className="flex gap-1 rounded-lg border bg-gray-50 p-1 text-xs font-medium">
          {(["softcover", "hardcover"] as const).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBinding(b)}
              className={cn(
                "flex-1 rounded-md py-1.5 transition-colors",
                effectiveBinding === b ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
              )}
            >
              {b === "softcover" ? "М'яка" : "Тверда"}
            </button>
          ))}
        </div>
      )}

      {hasBothColors && (
        <div className="flex gap-1 rounded-lg border bg-gray-50 p-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => setColorMode("color")}
            className={cn(
              "flex-1 rounded-md py-1.5 transition-colors",
              effectiveColorMode === "color" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
            )}
          >
            Кольоровий друк
          </button>
          <button
            type="button"
            onClick={() => setColorMode("bw")}
            className={cn(
              "flex-1 rounded-md py-1.5 transition-colors",
              effectiveColorMode === "bw" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
            )}
          >
            Чорно-білий друк
          </button>
        </div>
      )}

      {price != null && (
        <PriceAndCta
          price={price}
          label="Додати в кошик"
          cartProps={{
            bookId,
            format: cartFormat,
            price,
            title,
            author,
            coverUrl,
            formatLabel,
          }}
        />
      )}
    </div>
  );
}

function FormatPills({
  coverUrl,
  hasEbook,
  hasPrint,
  format,
  onChange,
}: {
  coverUrl?: string | null;
  hasEbook: boolean;
  hasPrint: boolean;
  format: "ebook" | "print";
  onChange: (f: "ebook" | "print") => void;
}) {
  if (!hasEbook || !hasPrint) return null; // only one option -- nothing to switch between

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange("ebook")}
        className={cn(
          "w-16 shrink-0 rounded-md p-1 transition-colors",
          format === "ebook" ? "ring-2 ring-gray-900" : "ring-1 ring-gray-200 opacity-60 hover:opacity-100"
        )}
      >
        <TabletCoverFrame coverUrl={coverUrl} className="pointer-events-none" />
        <p className="mt-1 text-center text-[10px] font-medium text-gray-600">Електронна</p>
      </button>
      <button
        type="button"
        onClick={() => onChange("print")}
        className={cn(
          "w-16 shrink-0 rounded-md p-1 transition-colors",
          format === "print" ? "ring-2 ring-gray-900" : "ring-1 ring-gray-200 opacity-60 hover:opacity-100"
        )}
      >
        <PrintedCoverFrame coverUrl={coverUrl} className="pointer-events-none" />
        <p className="mt-1 text-center text-[10px] font-medium text-gray-600">Друкована</p>
      </button>
    </div>
  );
}

function PriceAndCta({
  price,
  label,
  cartProps,
}: {
  price: number;
  label: string;
  cartProps: Omit<React.ComponentProps<typeof AddToCartButton>, "label" | "variant">;
}) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
      <p className="text-2xl font-bold text-gray-900">{price.toFixed(2)} грн</p>
      <AddToCartButton {...cartProps} label={label} variant="primary" />
    </div>
  );
}

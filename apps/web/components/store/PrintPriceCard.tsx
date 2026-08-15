"use client";

import { useState } from "react";
import { BuyButton } from "./BuyButton";

interface Props {
  bookId: string;
  bindingLabel: string;
  colorPrice?: number | null;
  bwPrice?: number | null;
  colorFormat: "PRINT_SOFTCOVER" | "PRINT_HARDCOVER";
  bwFormat: "PRINT_SOFTCOVER_BW" | "PRINT_HARDCOVER_BW";
}

// Black-and-white print is cheaper at the typography than color, so it gets
// its own settable price (pricePrintBw / pricePrintHardcoverBw) rather than
// an auto-computed discount. When the author has set both prices for a
// binding, this toggle switches which one is shown/ordered; when only one is
// set, it renders as a plain price card same as before.
export function PrintPriceCard({ bookId, bindingLabel, colorPrice, bwPrice, colorFormat, bwFormat }: Props) {
  const hasColor = !!colorPrice;
  const hasBw = !!bwPrice;
  const [mode, setMode] = useState<"color" | "bw">(hasColor ? "color" : "bw");

  if (!hasColor && !hasBw) return null;

  const price = mode === "color" ? colorPrice! : bwPrice!;
  const format = mode === "color" ? colorFormat : bwFormat;

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs text-gray-500">Друкована, {bindingLabel}</p>
          <p className="text-2xl font-bold text-gray-900">{price.toFixed(2)} грн</p>
        </div>
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
          Друк
        </span>
      </div>

      {hasColor && hasBw && (
        <div className="mb-3 flex gap-1 rounded-lg border bg-gray-50 p-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => setMode("color")}
            className={`flex-1 rounded-md py-1.5 transition-colors ${
              mode === "color" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Кольоровий друк
          </button>
          <button
            type="button"
            onClick={() => setMode("bw")}
            className={`flex-1 rounded-md py-1.5 transition-colors ${
              mode === "bw" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Чорно-білий друк
          </button>
        </div>
      )}

      <BuyButton bookId={bookId} format={format} price={price} label="Замовити друковану" variant="outline" />
    </div>
  );
}

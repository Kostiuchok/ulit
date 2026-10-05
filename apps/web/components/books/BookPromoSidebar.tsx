"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Clock, Package } from "lucide-react";
import { cn } from "@/lib/utils";

const SOON_LABELS = [
  "Про-акаунт",
  "Редактура",
  "Коректура",
  "Проста верстка",
  "Дизайн обкладинки",
  "Аудіокнига",
  "Офлайн-продаж",
  "Просування книги",
  "Буктрейлер",
];

interface Props {
  bookId: string;
}

// WF-SPEC "01 Дашборд" п.9 asked for active, clickable service cards with
// real prices (Про-акаунт, Редактура, ...) -- none of that is actually
// purchasable yet (no request form, no backend), so showing a price/chevron
// on them would be a fake "buy" affordance. Confirmed with Анатолій
// (2026-10-05): only "Замовити тираж" is real right now (/print-order
// already exists and works); everything else stays a single collapsed
// "Скоро" row with no prices, no fake buttons. Revisit once a request form
// for these services exists.
export function BookPromoSidebar({ bookId }: Props) {
  const [soonOpen, setSoonOpen] = useState(false);

  return (
    <div className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Зробіть книгу кращою</h2>

      <Link
        href={`/dashboard/books/${bookId}/print-order`}
        className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5 hover:border-gray-400"
      >
        <Package size={16} className="shrink-0 text-green-700" />
        <span className="text-sm font-medium text-black">Замовити тираж</span>
      </Link>

      <div className="rounded-lg border border-dashed border-gray-300">
        <button
          type="button"
          onClick={() => setSoonOpen((v) => !v)}
          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] text-gray-600"
        >
          <Clock size={14} className="shrink-0 text-gray-400" />
          <span>
            <b className="font-medium">Скоро:</b> {SOON_LABELS.join(", ")}
          </span>
          <ChevronDown size={14} className={cn("ml-auto shrink-0 text-gray-400 transition-transform", soonOpen && "rotate-180")} />
        </button>
        {soonOpen && (
          <div className="px-3 pb-3 text-xs text-gray-500">
            Ми повідомимо, коли ці послуги з&apos;являться.
          </div>
        )}
      </div>
    </div>
  );
}

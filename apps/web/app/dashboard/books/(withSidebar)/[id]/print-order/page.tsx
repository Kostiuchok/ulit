"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { cn } from "@/lib/utils";

// T-2063/T-2074 -- Ridero's "Заказать тираж" is its own page, separate from
// "Публикация в магазинах" (docs/ridero-research-preview-cover.md live test,
// same book id): author picks a quantity + binding, sees per-copy cost drop
// at bulk tiers, no store/channel involved -- this is the author buying
// physical copies for themselves, not a sale to a reader. Reuses the
// existing GET /api/books/:id/print-cost?quantity=N endpoint as-is
// (apps/api/src/modules/books/print-cost.ts already accepts quantity and
// walks PrintCostSettings.bulkTiers) -- no backend change needed, this page
// was the missing UI for cost data that already existed.
//
// Deliberately NOT built here (needs its own design pass before code, same
// as every other big feature this session): actually placing/paying for an
// order. Ridero also splits black-and-white vs color COST (not just the
// buyer-facing pricePrintBw/pricePrintHardcoverBw selling price we already
// have) -- our PrintCostSettings/BulkTier has no such field, so a color
// toggle here would have nothing real to compute against. Left out rather
// than faked.

type PrintCost =
  | { status: "DONE"; pageCount: number; quantity: number; softcoverCost: number; hardcoverCost: number }
  | { status: "NO_PAGE_COUNT" }
  | { status: "NO_SETTINGS" };

const QUANTITY_PRESETS = [1, 4, 20, 50, 100];

export default function PrintOrderPage() {
  const { id } = useParams<{ id: string }>();
  const { apiFetch, token } = useApi();
  const [quantity, setQuantity] = useState(20);
  const [cost, setCost] = useState<PrintCost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !id) return;
    setLoading(true);
    apiFetch<PrintCost>(`/api/books/${id}/print-cost?quantity=${quantity}`)
      .then(setCost)
      .catch(() => setCost(null))
      .finally(() => setLoading(false));
  }, [token, id, quantity]);

  return (
    <div className="p-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Замовити тираж</h1>
          <p className="mt-1 text-sm text-gray-500">
            Орієнтовна вартість друку паперових примірників для себе (не для продажу покупцям) —
            чим більший наклад, тим дешевша ціна за примірник.
          </p>
        </div>

        <div className="rounded-xl border bg-white p-6 shadow-sm space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="quantity" className="text-sm font-medium">Кількість примірників</label>
            <input
              id="quantity"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
              className="flex h-10 w-32 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {QUANTITY_PRESETS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuantity(q)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                    quantity === q ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  {q} екз.
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="h-24 animate-pulse rounded-lg bg-gray-100" />
          ) : !cost || cost.status === "NO_PAGE_COUNT" ? (
            <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
              Спершу завантажте рукопис і дочекайтесь підрахунку сторінок (сторінка «Вихідні дані» →
              «Рукопис») — вартість друку рахується з кількості сторінок.
            </p>
          ) : cost.status === "NO_SETTINGS" ? (
            <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
              Собівартість друку ще не налаштована адміністратором.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">М&apos;яка обкладинка</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">
                  {cost.softcoverCost.toFixed(2)} <span className="text-sm font-normal text-gray-500">грн/примірник</span>
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Разом за {cost.quantity} екз.: {(cost.softcoverCost * cost.quantity).toFixed(2)} грн
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Тверда обкладинка</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">
                  {cost.hardcoverCost.toFixed(2)} <span className="text-sm font-normal text-gray-500">грн/примірник</span>
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Разом за {cost.quantity} екз.: {(cost.hardcoverCost * cost.quantity).toFixed(2)} грн
                </p>
              </div>
            </div>
          )}

          <p className="border-t pt-3 text-xs text-gray-400">
            Оформлення й оплата замовлення тиражу — функція в розробці. Поки що це орієнтовний калькулятор.
          </p>
        </div>
      </div>
    </div>
  );
}

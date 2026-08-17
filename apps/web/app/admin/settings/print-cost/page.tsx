"use client";

import { useEffect, useState } from "react";
import { useApi } from "../../../../hooks/useApi";

interface BulkTier {
  minQuantity: number | string;
  baseCostSoftcover: number | string;
  baseCostHardcover: number | string;
  costPerPage: number | string;
}

interface PrintCostSettings {
  baseCostSoftcover: string;
  baseCostHardcover: string;
  costPerPage: string;
  bulkTiers: BulkTier[];
}

export default function PrintCostSettingsPage() {
  const { apiFetch, token } = useApi();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [baseCostSoftcover, setBaseCostSoftcover] = useState("");
  const [baseCostHardcover, setBaseCostHardcover] = useState("");
  const [costPerPage, setCostPerPage] = useState("");
  const [bulkTiers, setBulkTiers] = useState<BulkTier[]>([]);

  useEffect(() => {
    if (!token) return;
    apiFetch<{ settings: PrintCostSettings | null }>("/api/admin/print-cost-settings")
      .then(({ settings }) => {
        if (settings) {
          setBaseCostSoftcover(settings.baseCostSoftcover);
          setBaseCostHardcover(settings.baseCostHardcover);
          setCostPerPage(settings.costPerPage);
          setBulkTiers(settings.bulkTiers ?? []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  function addTier() {
    setBulkTiers((prev) => [...prev, { minQuantity: "", baseCostSoftcover: "", baseCostHardcover: "", costPerPage: "" }]);
  }

  function removeTier(index: number) {
    setBulkTiers((prev) => prev.filter((_, i) => i !== index));
  }

  function updateTier(index: number, field: keyof BulkTier, value: string) {
    setBulkTiers((prev) => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)));
  }

  async function handleSave() {
    setError("");
    setSaved(false);
    setSaving(true);
    try {
      await apiFetch("/api/admin/print-cost-settings", {
        method: "PATCH",
        body: JSON.stringify({ baseCostSoftcover, baseCostHardcover, costPerPage, bulkTiers }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.message || "Помилка збереження");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Собівартість друку</h1>
        <p className="text-sm text-gray-500 mt-1">
          Формула для оцінки, яку бачить автор у майстрі публікації:
          базова ставка + ціна за сторінку × кількість сторінок друкованого блоку.
          Розмір друку залежить від жанру книги (ДСТУ 3018-95, за замовчуванням — «Стандартний» 130×200мм);
          повна таблиця форматів — <code>packages/shared-types</code>, <code>PRINT_FORMATS</code>.
        </p>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 space-y-1.5">
        <p className="font-semibold">Технічні вимоги друкарні до готового файлу (звірено з кодом)</p>
        <ul className="list-disc space-y-1 pl-5 text-xs">
          <li>Кольоровий простір CMYK, 300 dpi — <strong>вже реалізовано</strong> в <code>generate-pdf-print.ts</code></li>
          <li>Мітки різу не додаються (друкарня додає сама) — <strong>вже відповідає</strong></li>
          <li>
            Кількість сторінок рекомендовано парна (для брошур на скобу — кратна 4), інакше можливі білі
            сторінки в кінці примірника — <strong className="text-amber-700">поки не реалізовано</strong>
          </li>
          <li>Файл до 1000 МБ — активної перевірки поки немає</li>
        </ul>
        <p className="text-xs text-blue-700">Повний довідник — <code>docs/print-file-technical-requirements.md</code></p>
      </div>

      <div className="rounded-xl border bg-white p-6 shadow-sm space-y-5">
        {loading ? (
          <div className="text-center text-gray-400 animate-pulse py-4">Завантаження…</div>
        ) : (
          <>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Базова собівартість — м&apos;яка обкладинка (грн)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={baseCostSoftcover}
                onChange={(e) => setBaseCostSoftcover(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Базова собівартість — тверда обкладинка (грн)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={baseCostHardcover}
                onChange={(e) => setBaseCostHardcover(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Ціна за сторінку (грн)</label>
              <input
                type="number"
                step="0.0001"
                min="0"
                value={costPerPage}
                onChange={(e) => setCostPerPage(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="border-t pt-5 space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-700">Ціни за тиражем (опційно)</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Дешевше за примірник при друку кількох копій одразу. Без жодного рядка тут — завжди діють
                  базові ставки вище, незалежно від тиражу.
                </p>
              </div>

              {bulkTiers.map((tier, i) => (
                <div key={i} className="flex items-end gap-2 rounded-lg border border-gray-200 p-3">
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500">Від, прим.</label>
                    <input
                      type="number"
                      min="2"
                      step="1"
                      value={tier.minQuantity}
                      onChange={(e) => updateTier(i, "minQuantity", e.target.value)}
                      className="h-9 w-20 rounded-md border border-input bg-background px-2 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500">М&apos;яка (грн)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={tier.baseCostSoftcover}
                      onChange={(e) => updateTier(i, "baseCostSoftcover", e.target.value)}
                      className="h-9 w-24 rounded-md border border-input bg-background px-2 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500">Тверда (грн)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={tier.baseCostHardcover}
                      onChange={(e) => updateTier(i, "baseCostHardcover", e.target.value)}
                      className="h-9 w-24 rounded-md border border-input bg-background px-2 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500">За сторінку (грн)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={tier.costPerPage}
                      onChange={(e) => updateTier(i, "costPerPage", e.target.value)}
                      className="h-9 w-24 rounded-md border border-input bg-background px-2 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeTier(i)}
                    className="h-9 rounded-md px-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    Видалити
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={addTier}
                className="rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                + Додати рівень тиражу
              </button>
            </div>

            {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            {saved && <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">✓ Збережено</div>}

            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? "Збереження…" : "Зберегти"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

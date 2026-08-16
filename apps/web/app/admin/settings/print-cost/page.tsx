"use client";

import { useEffect, useState } from "react";
import { useApi } from "../../../../hooks/useApi";

interface PrintCostSettings {
  baseCostSoftcover: string;
  baseCostHardcover: string;
  costPerPage: string;
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

  useEffect(() => {
    if (!token) return;
    apiFetch<{ settings: PrintCostSettings | null }>("/api/admin/print-cost-settings")
      .then(({ settings }) => {
        if (settings) {
          setBaseCostSoftcover(settings.baseCostSoftcover);
          setBaseCostHardcover(settings.baseCostHardcover);
          setCostPerPage(settings.costPerPage);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSave() {
    setError("");
    setSaved(false);
    setSaving(true);
    try {
      await apiFetch("/api/admin/print-cost-settings", {
        method: "PATCH",
        body: JSON.stringify({ baseCostSoftcover, baseCostHardcover, costPerPage }),
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
          Розмір друку на платформі фіксований для всіх книг (152 × 229 мм, 6 × 9″).
        </p>
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

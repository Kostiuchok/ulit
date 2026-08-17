"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DISTRIBUTION_PLATFORMS as PLATFORMS, KDP_EBOOK_UNSUPPORTED_LANGUAGES } from "@/lib/distributionPlatforms";

interface DistributionInfo {
  distributionChannels: string[];
  kdpSelectActive: boolean;
}

// T-2060 п.9/п.11 -- один "бажане роялті за примірник" → жива автоціна для
// КОЖНОГО каналу за його власною формулою комісії (той самий патерн, що й
// Ridero). Канали з діапазоном комісії (KDP 35-70%) дають діапазон ціни:
// найдешевша ціна при найкращій комісії (royaltyMax) .. найдорожча при
// найгіршій (royaltyMin) -- симетрично до того, як існуючий блок "Огляд"
// (output-data/page.tsx) уже рахує прибуток ІЗ ціни в інший бік.
function suggestedPriceRange(royalty: number, royaltyMin: number, royaltyMax: number): { min: number; max: number } {
  return { min: royalty / royaltyMax, max: royalty / royaltyMin };
}

function formatUah(n: number): string {
  return `${n.toFixed(2)} грн`;
}

export function DistributionChannelPicker({
  bookId,
  language,
  initialDesiredRoyaltyAmount,
}: {
  bookId: string;
  language?: string;
  initialDesiredRoyaltyAmount?: number | string | null;
}) {
  const { apiFetch, token } = useApi();
  const [channels, setChannels] = useState<string[] | null>(null);
  const [kdpActive, setKdpActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [royaltyInput, setRoyaltyInput] = useState(
    initialDesiredRoyaltyAmount ? String(Number(initialDesiredRoyaltyAmount)) : ""
  );
  const [royaltySaving, setRoyaltySaving] = useState(false);
  const [royaltySaved, setRoyaltySaved] = useState(false);
  const royaltyValue = Number(royaltyInput.replace(",", "."));
  const royaltyValid = royaltyInput.trim() !== "" && Number.isFinite(royaltyValue) && royaltyValue > 0;

  useEffect(() => {
    if (!token) return;
    apiFetch<DistributionInfo>(`/api/books/${bookId}/distribution`)
      .then((info) => {
        setChannels(info.distributionChannels);
        setKdpActive(info.kdpSelectActive);
      })
      .catch((e: any) => setError(e.message || "Помилка завантаження"));
  }, [token, bookId]);

  function toggle(key: string) {
    if (key === "ULIT" || !channels) return;
    setSaved(false);
    setChannels((prev) => (prev!.includes(key) ? prev!.filter((c) => c !== key) : [...prev!, key]));
  }

  async function save() {
    if (!channels) return;
    setSaving(true);
    setError("");
    try {
      const updated = await apiFetch<{ distributionChannels: string[]; kdpSelectEnrolled: boolean }>(
        `/api/books/${bookId}/distribution`,
        { method: "PATCH", body: JSON.stringify({ distributionChannels: channels }) }
      );
      setChannels(updated.distributionChannels);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.message || "Помилка збереження");
    } finally {
      setSaving(false);
    }
  }

  async function saveRoyalty() {
    setRoyaltySaving(true);
    setError("");
    try {
      await apiFetch(`/api/books/${bookId}`, {
        method: "PATCH",
        body: JSON.stringify({ desiredRoyaltyAmount: royaltyValid ? royaltyValue : null }),
      });
      setRoyaltySaved(true);
      setTimeout(() => setRoyaltySaved(false), 3000);
    } catch (e: any) {
      setError(e.message || "Помилка збереження");
    } finally {
      setRoyaltySaving(false);
    }
  }

  if (!channels) return null;

  const isKdpSelect = channels.includes("KDP") && !channels.includes("D2D") && !channels.includes("GOOGLE");
  const kdpEbookUnsupported = !!language && KDP_EBOOK_UNSUPPORTED_LANGUAGES.includes(language);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
        <label htmlFor="desiredRoyalty" className="block text-sm font-medium text-gray-700">
          Бажане роялті за примірник (грн)
        </label>
        <p className="text-xs text-gray-500">
          Скільки ви хочете отримувати з продажу одного примірника — ціна для кожного каналу нижче
          порахується автоматично з урахуванням його комісії.
        </p>
        <div className="flex items-center gap-2">
          <input
            id="desiredRoyalty"
            type="number"
            step="0.01"
            min="0"
            value={royaltyInput}
            onChange={(e) => { setRoyaltyInput(e.target.value); setRoyaltySaved(false); }}
            placeholder="напр. 50"
            className="h-9 w-32 rounded-md border border-input bg-white px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button size="sm" variant="outline" onClick={saveRoyalty} loading={royaltySaving}>
            Зберегти
          </Button>
          {royaltySaved && <span className="text-xs text-green-600">✓ Збережено</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PLATFORMS.map((p) => {
          const selected = channels.includes(p.key);
          const range = royaltyValid ? suggestedPriceRange(royaltyValue, p.royaltyMin, p.royaltyMax) : null;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => toggle(p.key)}
              disabled={p.locked || (kdpActive && !selected)}
              className={cn(
                "rounded-xl border-2 p-4 text-left transition-colors",
                selected ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300",
                (p.locked || (kdpActive && !selected)) && "cursor-default opacity-70"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{p.icon}</span>
                  <span className="font-semibold text-sm">{p.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-medium text-green-600">{p.royalty}</span>
                  <div
                    className={cn(
                      "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0",
                      selected ? "border-primary bg-primary" : "border-gray-300"
                    )}
                  >
                    {selected && <span className="text-white text-[10px] leading-none">✓</span>}
                  </div>
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-500">{p.description}</p>
              {range && (
                <p className="mt-1 text-xs font-medium text-primary">
                  Ціна ≈{" "}
                  {range.min === range.max
                    ? formatUah(range.min)
                    : `${formatUah(range.min)} – ${formatUah(range.max)}`}
                </p>
              )}
              {p.locked && <p className="mt-1 text-xs text-gray-400">Не можна вимкнути</p>}
              {p.key === "KDP" && kdpEbookUnsupported && (
                <p className="mt-1 text-xs font-medium text-amber-600">
                  Amazon KDP для цієї мови приймає лише друковані видання — електронна книга на Kindle
                  видана не буде. Щоб опублікувати й електронну версію, книгу можна перекласти
                  мовою, яку Kindle підтримує (зокрема за допомогою штучного інтелекту).
                </p>
              )}
            </button>
          );
        })}
      </div>

      {isKdpSelect && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
          <span className="font-medium">KDP Select (Kindle Unlimited)</span> — ексклюзивна угода з Amazon на 90 днів.
          Протягом цього часу книга не може продаватись на D2D та Google Play Books.
        </div>
      )}
      {kdpActive && (
        <p className="text-xs text-gray-500">
          KDP Select активний — Draft2Digital і Google Play Books недоступні до завершення терміну.
        </p>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={save} loading={saving}>
          Зберегти платформи
        </Button>
        {saved && <span className="text-sm text-green-600">✓ Збережено</span>}
      </div>
    </div>
  );
}

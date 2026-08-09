"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const PLATFORMS = [
  {
    key: "ULIT",
    icon: "📚",
    name: "Магазин Ulit",
    royalty: "70%",
    description: "Власний магазин платформи. Завжди увімкнений.",
    locked: true,
  },
  {
    key: "D2D",
    icon: "🌐",
    name: "Draft2Digital",
    royalty: "60%",
    description: "40+ ритейлерів: Barnes & Noble, Kobo, Apple Books та інші.",
    locked: false,
  },
  {
    key: "KDP",
    icon: "🔶",
    name: "Amazon KDP",
    royalty: "35–70%",
    description: "Amazon Kindle Store. Якщо обрано без D2D і Google — активується KDP Select (90 днів ексклюзивності).",
    locked: false,
  },
  {
    key: "GOOGLE",
    icon: "🎮",
    name: "Google Play Books",
    royalty: "52%",
    description: "Google Play Books Store.",
    locked: false,
  },
] as const;

interface DistributionInfo {
  distributionChannels: string[];
  kdpSelectActive: boolean;
}

export function DistributionChannelPicker({ bookId }: { bookId: string }) {
  const { apiFetch, token } = useApi();
  const [channels, setChannels] = useState<string[] | null>(null);
  const [kdpActive, setKdpActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

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

  if (!channels) return null;

  const isKdpSelect = channels.includes("KDP") && !channels.includes("D2D") && !channels.includes("GOOGLE");

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PLATFORMS.map((p) => {
          const selected = channels.includes(p.key);
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
              {p.locked && <p className="mt-1 text-xs text-gray-400">Не можна вимкнути</p>}
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

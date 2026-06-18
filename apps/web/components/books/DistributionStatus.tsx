"use client";

import { useEffect, useState } from "react";
import { useApi } from "../../hooks/useApi";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

interface ServiceInfo {
  status: string;
  sentAt?: string | null;
  blocked: boolean;
}

interface DistributionInfo {
  distributionStrategy: "WIDE" | "KDP_SELECT";
  kdpSelectEnrolled: boolean;
  kdpSelectExpiry?: string | null;
  kdpSelectDaysLeft?: number | null;
  kdpSelectActive: boolean;
  services: {
    d2d: ServiceInfo;
    kdp: ServiceInfo;
    google: ServiceInfo;
  };
}

const SERVICE_LABELS = { d2d: "Draft2Digital", kdp: "Amazon KDP", google: "Google Play Books" };

function getStatusConfig(status: string, bookPublished: boolean): { label: string; dot: string } {
  if (status === "NOT_SENT") return bookPublished
    ? { label: "Очікує відправки", dot: "bg-yellow-400" }
    : { label: "Не надіслано", dot: "bg-gray-300" };
  const map: Record<string, { label: string; dot: string }> = {
    SENT: { label: "Надіслано", dot: "bg-blue-500" },
    PUBLISHED: { label: "Опубліковано", dot: "bg-green-500" },
    ERROR: { label: "Помилка", dot: "bg-red-500" },
  };
  return map[status] ?? { label: "Не надіслано", dot: "bg-gray-300" };
}

interface Props {
  bookId: string;
  bookStatus: string;
}

export function DistributionStatus({ bookId, bookStatus }: Props) {
  const { apiFetch, token } = useApi();
  const [info, setInfo] = useState<DistributionInfo | null>(null);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    apiFetch<DistributionInfo>(`/api/books/${bookId}/distribution`)
      .then(setInfo)
      .catch(() => {});
  }, [token, bookId]);

  async function switchToWide() {
    if (!confirm("Перейти на широке розповсюдження? Книга стане доступна на D2D та Google Play.")) return;
    setSwitching(true);
    setError("");
    try {
      const updated = await apiFetch<DistributionInfo>(`/api/books/${bookId}/distribution`, {
        method: "PATCH",
        body: JSON.stringify({ distributionStrategy: "WIDE" }),
      });
      setInfo((prev) => prev ? { ...prev, ...updated } : updated);
    } catch (e: any) {
      setError(e.message || "Помилка");
    } finally {
      setSwitching(false);
    }
  }

  async function enrollKdpSelect() {
    if (!confirm("Зареєструватись у KDP Select? Книга буде ексклюзивна на Amazon 90 днів.")) return;
    setSwitching(true);
    setError("");
    try {
      const updated = await apiFetch<DistributionInfo>(`/api/books/${bookId}/distribution`, {
        method: "PATCH",
        body: JSON.stringify({ distributionStrategy: "KDP_SELECT" }),
      });
      setInfo((prev) => prev ? { ...prev, ...updated } : updated);
    } catch (e: any) {
      setError(e.message || "Помилка");
    } finally {
      setSwitching(false);
    }
  }

  if (!info) return null;

  const isKdpActive = info.kdpSelectActive;
  const expiryDate = info.kdpSelectExpiry
    ? new Date(info.kdpSelectExpiry).toLocaleDateString("uk-UA", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm space-y-5">
      <h2 className="text-base font-semibold">Стратегія розповсюдження</h2>

      {/* Strategy badge */}
      <div className="flex items-center gap-3">
        <span className={cn(
          "rounded-full px-3 py-1 text-sm font-medium",
          info.distributionStrategy === "KDP_SELECT"
            ? "bg-amber-100 text-amber-800"
            : "bg-blue-100 text-blue-800"
        )}>
          {info.distributionStrategy === "KDP_SELECT" ? "🔶 KDP Select" : "🌐 Широке розповсюдження"}
        </span>

        {isKdpActive && info.kdpSelectDaysLeft !== null && (
          <span className="text-sm text-gray-500">
            Залишилось: <strong>{info.kdpSelectDaysLeft} дн.</strong>
            {expiryDate && <span className="text-gray-400"> (до {expiryDate})</span>}
          </span>
        )}
      </div>

      {/* Next-step banner for published books */}
      {bookStatus === "PUBLISHED" && (
        <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800 space-y-1">
          <p className="font-medium">✓ Книга опублікована — що відбувається далі?</p>
          {isKdpActive ? (
            <p className="text-blue-700">
              Ми відправимо її на <strong>Amazon KDP</strong> протягом 2–3 робочих днів.{" "}
              Draft2Digital та Google Play Books стануть доступні після завершення KDP Select
              {expiryDate ? <> (до <strong>{expiryDate}</strong>)</> : <> (через 90 дн.)</>}.
            </p>
          ) : (
            <p className="text-blue-700">
              Ми відправимо книгу на <strong>Draft2Digital</strong>, <strong>Amazon KDP</strong> та{" "}
              <strong>Google Play Books</strong> протягом 2–3 робочих днів.
              Ви отримаєте email після розміщення на кожній платформі.
            </p>
          )}
        </div>
      )}

      {/* KDP Select explanation */}
      {isKdpActive && (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 space-y-1">
          <p className="font-medium">Що таке KDP Select?</p>
          <p className="text-amber-700">
            KDP Select — програма Amazon, яка вимагає <strong>ексклюзивного</strong> розміщення: поки вона активна,
            книга не може продаватись на інших платформах (Draft2Digital, Google Play Books).
            Натомість Amazon надає підвищені роялті та доступ до Kindle Unlimited.
          </p>
          {expiryDate && (
            <p className="text-amber-700">
              Ексклюзивність діє до <strong>{expiryDate}</strong>.
              Після цього ви зможете перейти на широке розповсюдження.
            </p>
          )}
        </div>
      )}

      {/* KDP Select expiry warning */}
      {isKdpActive && info.kdpSelectDaysLeft != null && info.kdpSelectDaysLeft <= 14 && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
          ⚠ KDP Select закінчується через {info.kdpSelectDaysLeft} дн. Ви отримаєте email за 7 днів до закінчення.
        </div>
      )}

      {/* Services grid */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {(Object.entries(info.services) as [keyof typeof SERVICE_LABELS, ServiceInfo][]).map(([key, svc]) => {
          const cfg = getStatusConfig(svc.status, bookStatus === "PUBLISHED");
          return (
            <div
              key={key}
              className={cn(
                "rounded-lg border p-3 text-sm",
                svc.blocked && "opacity-50"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-gray-700">{SERVICE_LABELS[key]}</span>
                <span className={cn("h-2 w-2 rounded-full", cfg.dot)} />
              </div>
              <p className="text-xs text-gray-500">{cfg.label}</p>
              {svc.blocked && (
                <p className="text-xs text-amber-600 mt-1" title="Недоступно до завершення 90-денного терміну KDP Select">
                  🔒 Недоступно (KDP Select)
                </p>
              )}
              {svc.sentAt && (
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(svc.sentAt).toLocaleDateString("uk-UA")}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Switch actions */}
      {bookStatus === "PUBLISHED" && (
        <div className="flex gap-2 pt-1">
          {isKdpActive ? (
            <Button
              size="sm"
              variant="outline"
              onClick={switchToWide}
              loading={switching}
              disabled={info.kdpSelectDaysLeft != null && info.kdpSelectDaysLeft > 0}
            >
              {info.kdpSelectDaysLeft != null && info.kdpSelectDaysLeft > 0
                ? `Широке розповсюдження (через ${info.kdpSelectDaysLeft} дн.)`
                : "Перейти на широке розповсюдження"}
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={enrollKdpSelect} loading={switching}>
              Зареєструватись у KDP Select
            </Button>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useApi } from "../../hooks/useApi";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { QuestionHint } from "./QuestionHint";

const ACCENT = "#50a406";
const KDP_COLOR = "#b45309";

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

function fmt(date: string) {
  return new Date(date).toLocaleDateString("uk-UA");
}

function getStatusConfig(status: string, bookPublished: boolean): { label: string; done: boolean } {
  if (status === "NOT_SENT") return { label: bookPublished ? "Очікує відправки" : "Не надіслано", done: false };
  const map: Record<string, { label: string; done: boolean }> = {
    SENT: { label: "Надіслано", done: true },
    PUBLISHED: { label: "Опубліковано", done: true },
    ERROR: { label: "Помилка", done: false },
  };
  return map[status] ?? { label: "Не надіслано", done: false };
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
  const isPublished = bookStatus === "PUBLISHED";
  const expiryDate = info.kdpSelectExpiry
    ? new Date(info.kdpSelectExpiry).toLocaleDateString("uk-UA", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div>
      <p className="text-sm font-bold text-black">Стратегія розповсюдження</p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold" style={{ color: isKdpActive ? KDP_COLOR : ACCENT }}>
          {isKdpActive ? "KDP Select" : "Широке розповсюдження"}
        </span>
        {isKdpActive && (
          <QuestionHint title="Що таке KDP Select?">
            <p className="font-semibold">Що таке KDP Select?</p>
            <p className="mt-1">
              Програма Amazon, яка вимагає ексклюзивного розміщення: поки вона активна, книга не може
              продаватись на інших платформах (Draft2Digital, Google Play Books). Натомість Amazon надає
              підвищені роялті та доступ до Kindle Unlimited.
            </p>
            {expiryDate && (
              <p className="mt-1">
                Ексклюзивність діє до <strong>{expiryDate}</strong>.
              </p>
            )}
          </QuestionHint>
        )}
        {isKdpActive && info.kdpSelectDaysLeft != null && (
          <span className="text-sm text-gray-500">
            Залишилось: {info.kdpSelectDaysLeft} дн.
            {expiryDate && ` (до ${expiryDate})`}
          </span>
        )}
      </div>

      {isKdpActive && info.kdpSelectDaysLeft != null && info.kdpSelectDaysLeft <= 14 && (
        <p className="mt-1 text-[0.8125rem] text-red-600">
          ⚠ Закінчується через {info.kdpSelectDaysLeft} дн. — email прийде за 7 днів до закінчення.
        </p>
      )}

      {isPublished && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-sm text-black">
            {isKdpActive ? (
              <>
                Далі: відправимо на <strong>Amazon KDP</strong> протягом 2–3 робочих днів.
              </>
            ) : (
              <>
                Далі: відправимо на <strong>Draft2Digital</strong>, <strong>Amazon KDP</strong> та{" "}
                <strong>Google Play Books</strong> протягом 2–3 робочих днів.
              </>
            )}
          </span>
          <QuestionHint title="Що відбувається далі?">
            {isKdpActive ? (
              <>
                Draft2Digital та Google Play Books стануть доступні після завершення KDP Select
                {expiryDate ? (
                  <>
                    {" "}(до <strong>{expiryDate}</strong>)
                  </>
                ) : (
                  " (через 90 дн.)"
                )}
                .
              </>
            ) : (
              "Ви отримаєте email після розміщення на кожній платформі."
            )}
          </QuestionHint>
        </div>
      )}

      <div className="mt-3 space-y-1">
        {(Object.entries(info.services) as [keyof typeof SERVICE_LABELS, ServiceInfo][]).map(([key, svc]) => {
          const cfg = getStatusConfig(svc.status, isPublished);
          return (
            <div key={key} className="flex flex-wrap items-center gap-1.5 text-sm">
              <span style={cfg.done ? { color: ACCENT } : undefined} className={!cfg.done ? "text-gray-300" : undefined}>
                {cfg.done ? "✓" : "✕"}
              </span>
              <span
                style={cfg.done ? { color: ACCENT } : undefined}
                className={cn(!cfg.done && (svc.blocked ? "text-gray-400" : "text-black"))}
              >
                {SERVICE_LABELS[key]}
              </span>
              <span className="text-gray-500">{cfg.label}</span>
              {svc.sentAt && <span className="text-gray-500">/ {fmt(svc.sentAt)}</span>}
              {svc.blocked && (
                <QuestionHint title="Чому недоступно?">
                  Недоступно до завершення 90-денного терміну KDP Select.
                </QuestionHint>
              )}
            </div>
          );
        })}
      </div>

      {isPublished && (
        <div className="mt-4">
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
            <div className="flex flex-wrap items-center gap-1.5">
              <Button size="sm" variant="outline" onClick={enrollKdpSelect} loading={switching}>
                Зареєструватись у KDP Select
              </Button>
              <QuestionHint title="Що таке KDP Select?">
                <p className="font-semibold">Що таке KDP Select?</p>
                <p className="mt-1">
                  Дає доступ до Kindle Unlimited (читачі платять підписку і читають безкоштовно, ви отримуєте
                  роялті за сторінки) і вищу ставку роялті на Amazon (до 70%).
                </p>
                <p className="mt-1 text-red-600">
                  Ексклюзивність 90 днів: Draft2Digital і Google Play Books будуть заблоковані, скасувати не
                  можна до кінця терміну.
                </p>
              </QuestionHint>
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  );
}

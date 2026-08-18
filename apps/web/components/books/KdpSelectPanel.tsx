"use client";

import { useEffect, useState } from "react";
import { useApi } from "../../hooks/useApi";
import { Button } from "../ui/button";
import { QuestionHint } from "./QuestionHint";

const ACCENT = "#50a406";
const KDP_COLOR = "#b45309";

interface DistributionInfo {
  distributionStrategy: "WIDE" | "KDP_SELECT";
  kdpSelectEnrolled: boolean;
  kdpSelectExpiry?: string | null;
  kdpSelectDaysLeft?: number | null;
  kdpSelectActive: boolean;
}

interface Props {
  bookId: string;
  bookStatus: string;
}

// Post-publish strategy management (pre-publish, FormatsAndDistribution
// already covers channel selection — this is specifically for switching an
// already-live book, which needs the extra confirmation/warning UX below).
export function KdpSelectPanel({ bookId, bookStatus }: Props) {
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
      setInfo((prev) => (prev ? { ...prev, ...updated } : updated));
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
      setInfo((prev) => (prev ? { ...prev, ...updated } : updated));
    } catch (e: any) {
      setError(e.message || "Помилка");
    } finally {
      setSwitching(false);
    }
  }

  const isPublished = bookStatus === "PUBLISHED";
  if (!info || !isPublished) return null;

  const isKdpActive = info.kdpSelectActive;
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

      <div className="mt-3">
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

      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  );
}

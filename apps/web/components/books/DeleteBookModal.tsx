"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { cn } from "@/lib/utils";

interface Props {
  bookId: string;
  // Undefined while the caller's own list hasn't loaded this book yet --
  // just means the "Зняти з продажу натомість" nudge below stays hidden,
  // never a hard requirement to open the modal at all.
  bookStatus?: string;
  onClose: () => void;
  onDeleted: () => void;
}

interface DeleteImpact {
  salesCount: number;
  kdpSelectActive: boolean;
  kdpSelectExpiry: string | null;
  externalLive: { d2d: boolean; kdp: boolean; google: boolean };
}

const EXTERNAL_CHANNEL_LABELS: Record<keyof DeleteImpact["externalLive"], string> = {
  d2d: "D2D",
  kdp: "Amazon KDP",
  google: "Google Play Books",
};

export function DeleteBookModal({ bookId, bookStatus, onClose, onDeleted }: Props) {
  const { apiFetch } = useApi();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [impact, setImpact] = useState<DeleteImpact | null>(null);
  const [impactLoading, setImpactLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setImpactLoading(true);
    apiFetch<DeleteImpact>(`/api/books/${bookId}/delete-impact`)
      .then((data) => {
        if (!cancelled) setImpact(data);
      })
      .catch(() => {
        // Not fatal -- the generic confirm text below still applies even if
        // this extra context fails to load; deletion itself doesn't depend on it.
      })
      .finally(() => {
        if (!cancelled) setImpactLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  async function confirmDelete() {
    setDeleting(true);
    setError("");
    try {
      await apiFetch(`/api/books/${bookId}`, { method: "DELETE" });
      onDeleted();
    } catch (e: any) {
      setError(e.message || "Помилка видалення");
      setDeleting(false);
    }
  }

  if (!mounted) return null;

  const liveChannels = impact
    ? (Object.keys(impact.externalLive) as (keyof DeleteImpact["externalLive"])[]).filter(
        (k) => impact.externalLive[k]
      )
    : [];
  const expiryDate = impact?.kdpSelectExpiry
    ? new Date(impact.kdpSelectExpiry).toLocaleDateString("uk-UA")
    : null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="relative w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          disabled={deleting}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-700"
        >
          <X size={18} />
        </button>
        <h2 className="mb-3 text-center text-lg font-bold text-black">Видалити книгу?</h2>

        {/* Реальні наслідки цієї конкретної книги -- показуємо лише те, що
            застосовне (порожня чернетка без продажів не отримає жодного з
            цих рядків). Не блокує видалення -- автор і далі вирішує сам,
            /delete-impact лише інформує. */}
        {!impactLoading && impact && (impact.salesCount > 0 || impact.kdpSelectActive || liveChannels.length > 0) && (
          <div className="mb-4 space-y-2 rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
            {impact.salesCount > 0 && (
              <p>
                Цю книгу купували {impact.salesCount} раз{impact.salesCount === 1 ? "" : "ів"}. Оплачені замовлення
                не скасовуються — покупці й далі матимуть доступ до файлів, роялті лишаються.
              </p>
            )}
            {impact.kdpSelectActive && (
              <p>
                ⚠ Книга досі в ексклюзивній угоді KDP Select{expiryDate ? ` до ${expiryDate}` : ""}. Видалення на Ulit
                НЕ розриває цю угоду з Amazon.
              </p>
            )}
            {liveChannels.length > 0 && (
              <p>
                Книга опублікована на {liveChannels.map((k) => EXTERNAL_CHANNEL_LABELS[k]).join(", ")}. Ulit не може
                автоматично зняти її звідти — адміністрація отримає завдання зробити це вручну.
              </p>
            )}
          </div>
        )}

        <p className={cn("text-center text-sm text-gray-600", bookStatus === "PUBLISHED" ? "mb-2" : "mb-5")}>
          Книга опиниться у видалених книгах наприкінці списку ваших книг. Ви зможете відновити її будь-якої миті.
        </p>
        {bookStatus === "PUBLISHED" && (
          <p className="mb-5 text-center text-xs text-gray-400">
            Хочете лише тимчасово прибрати книгу з продажу? На сторінці книги є легша й повністю зворотна дія —
            «Зняти з публікації».
          </p>
        )}
        {error && <p className="mb-3 text-center text-sm text-red-500">{error}</p>}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={confirmDelete}
            disabled={deleting}
            className="flex-1 rounded-md bg-[#ff5900] py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#e64f00] disabled:opacity-50"
          >
            {deleting ? "…" : "ТАК"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="flex-1 rounded-md border-2 border-[#ff5900] py-2.5 text-sm font-bold text-[#ff5900] transition-colors hover:bg-orange-50 disabled:opacity-50"
          >
            СКАСУВАННЯ
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

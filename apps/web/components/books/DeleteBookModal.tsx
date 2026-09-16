"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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
  const [impact, setImpact] = useState<DeleteImpact | null>(null);
  const [impactLoading, setImpactLoading] = useState(true);

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

  const liveChannels = impact
    ? (Object.keys(impact.externalLive) as (keyof DeleteImpact["externalLive"])[]).filter(
        (k) => impact.externalLive[k]
      )
    : [];
  const expiryDate = impact?.kdpSelectExpiry
    ? new Date(impact.kdpSelectExpiry).toLocaleDateString("uk-UA")
    : null;

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !deleting) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogTitle className="text-center text-lg font-bold text-black">Видалити книгу?</DialogTitle>

        {/* Реальні наслідки цієї конкретної книги -- показуємо лише те, що
            застосовне (порожня чернетка без продажів не отримає жодного з
            цих рядків). Не блокує видалення -- автор і далі вирішує сам,
            /delete-impact лише інформує. */}
        {!impactLoading && impact && (impact.salesCount > 0 || impact.kdpSelectActive || liveChannels.length > 0) && (
          <div className="space-y-2 rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
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
          <Button
            type="button"
            onClick={confirmDelete}
            loading={deleting}
            className="flex-1 bg-[#ff5900] font-bold hover:bg-[#e64f00]"
          >
            ТАК
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={deleting}
            className="flex-1 border-2 border-[#ff5900] font-bold text-[#ff5900] hover:bg-orange-50 hover:text-[#ff5900]"
          >
            СКАСУВАННЯ
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

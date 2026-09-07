"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useApi } from "../../hooks/useApi";

interface Props {
  bookId: string;
  onUnpublished?: () => void;
}

interface DeleteImpact {
  externalLive: { d2d: boolean; kdp: boolean; google: boolean };
  kdpSelectActive: boolean;
  kdpSelectExpiry: string | null;
}

const EXTERNAL_CHANNEL_LABELS: Record<keyof DeleteImpact["externalLive"], string> = {
  d2d: "D2D",
  kdp: "Amazon KDP",
  google: "Google Play Books",
};

export function UnpublishButton({ bookId, onUnpublished }: Props) {
  const { apiFetch } = useApi();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [impact, setImpact] = useState<DeleteImpact | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Same /delete-impact endpoint DeleteBookModal.tsx uses -- shape is
  // book-status-agnostic (sales/KDP Select/external-channel facts), so it
  // works just as well here. Fetched fresh each time the dialog opens
  // rather than kept from a stale earlier open.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    apiFetch<DeleteImpact>(`/api/books/${bookId}/delete-impact`)
      .then((data) => {
        if (!cancelled) setImpact(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bookId]);

  async function confirmUnpublish() {
    setLoading(true);
    setError("");
    try {
      await apiFetch(`/api/books/${bookId}/unpublish`, { method: "POST", body: JSON.stringify({}) });
      setOpen(false);
      onUnpublished?.();
    } catch (e: any) {
      setError(e.message || "Помилка зняття з публікації");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-black px-4 py-2 text-sm text-black hover:bg-gray-50"
      >
        Зняти з публікації
      </button>
      {open && mounted &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="relative w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={loading}
                className="absolute right-4 top-4 text-gray-400 hover:text-gray-700"
              >
                <X size={18} />
              </button>
              <h2 className="mb-3 text-center text-lg font-bold text-black">Зняти книгу з публікації?</h2>

              {/* Правдиве обмеження замість "буде знята з зовнішніх майданчиків" --
                  D2D/KDP/Google це виключно ручний процес адміна (форми + ZIP,
                  жодного API), зняття з публікації тут НІЧОГО не робить з тими
                  каналами саме по собі. Показуємо лише коли справді застосовно. */}
              {impact && (impact.externalLive.d2d || impact.externalLive.kdp || impact.externalLive.google || impact.kdpSelectActive) && (
                <div className="mb-3 space-y-1.5 rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                  {(impact.externalLive.d2d || impact.externalLive.kdp || impact.externalLive.google) && (
                    <p>
                      Книга опублікована на{" "}
                      {(Object.keys(impact.externalLive) as (keyof DeleteImpact["externalLive"])[])
                        .filter((k) => impact.externalLive[k])
                        .map((k) => EXTERNAL_CHANNEL_LABELS[k])
                        .join(", ")}
                      . Зняття з публікації на Ulit НЕ знімає книгу звідти — це окремий ручний крок
                      адміністрації.
                    </p>
                  )}
                  {impact.kdpSelectActive && (
                    <p>
                      ⚠ Книга досі в ексклюзивній угоді KDP Select
                      {impact.kdpSelectExpiry ? ` до ${new Date(impact.kdpSelectExpiry).toLocaleDateString("uk-UA")}` : ""}.
                    </p>
                  )}
                </div>
              )}

              <p className="mb-5 text-center text-sm text-gray-600">
                Книга зникне з магазину Ulit. Файли й ISBN збережуться — книга лишиться у вашому кабінеті, і ви
                зможете опублікувати її знову будь-якої миті.
              </p>
              {error && <p className="mb-3 text-center text-sm text-red-500">{error}</p>}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={confirmUnpublish}
                  disabled={loading}
                  className="flex-1 rounded-md bg-[#ff5900] py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#e64f00] disabled:opacity-50"
                >
                  {loading ? "…" : "ТАК"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                  className="flex-1 rounded-md border-2 border-[#ff5900] py-2.5 text-sm font-bold text-[#ff5900] transition-colors hover:bg-orange-50 disabled:opacity-50"
                >
                  СКАСУВАННЯ
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

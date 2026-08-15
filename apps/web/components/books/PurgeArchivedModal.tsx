"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useApi } from "@/hooks/useApi";

interface Props {
  count: number;
  onClose: () => void;
  onPurged: (result: { purged: string[]; skipped: { id: string; title: string }[] }) => void;
}

export function PurgeArchivedModal({ count, onClose, onPurged }: Props) {
  const { apiFetch } = useApi();
  const [purging, setPurging] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function confirmPurge() {
    setPurging(true);
    setError("");
    try {
      const result = await apiFetch<{ purged: string[]; skipped: { id: string; title: string }[] }>(
        "/api/books/purge-archived",
        { method: "POST" }
      );
      onPurged(result);
    } catch (e: any) {
      setError(e.message || "Помилка очищення списку");
      setPurging(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="relative w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          disabled={purging}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-700"
        >
          <X size={18} />
        </button>
        <h2 className="mb-3 text-center text-lg font-bold text-black">Очистити список видалених?</h2>
        <p className="mb-5 text-center text-sm text-gray-600">
          {count === 1 ? "1 книга буде" : `${count} книг будуть`} видалені остаточно, без можливості
          відновлення. Книги, які вже колись продавались, буде пропущено — їхня історія замовлень
          лишається недоторканою.
        </p>
        {error && <p className="mb-3 text-center text-sm text-red-500">{error}</p>}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={confirmPurge}
            disabled={purging}
            className="flex-1 rounded-md bg-[#ff5900] py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#e64f00] disabled:opacity-50"
          >
            {purging ? "…" : "ОЧИСТИТИ"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={purging}
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

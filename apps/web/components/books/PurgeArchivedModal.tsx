"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  count: number;
  onClose: () => void;
  onPurged: (result: { purged: string[]; skipped: { id: string; title: string }[] }) => void;
}

export function PurgeArchivedModal({ count, onClose, onPurged }: Props) {
  const { apiFetch } = useApi();
  const [purging, setPurging] = useState(false);
  const [error, setError] = useState("");

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

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !purging) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogTitle className="text-center text-lg font-bold text-black">Очистити список видалених?</DialogTitle>
        <p className="text-center text-sm text-gray-600">
          {count === 1 ? "1 книга буде" : `${count} книг будуть`} видалені остаточно, без можливості
          відновлення. Книги, які вже колись продавались, буде пропущено — їхня історія замовлень
          лишається недоторканою.
        </p>
        {error && <p className="text-center text-sm text-red-500">{error}</p>}
        <div className="flex gap-3">
          <Button
            type="button"
            onClick={confirmPurge}
            loading={purging}
            className="flex-1 bg-[#ff5900] font-bold hover:bg-[#e64f00]"
          >
            ОЧИСТИТИ
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={purging}
            className="flex-1 border-2 border-[#ff5900] font-bold text-[#ff5900] hover:bg-orange-50 hover:text-[#ff5900]"
          >
            СКАСУВАННЯ
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

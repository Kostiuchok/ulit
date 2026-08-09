"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useApi } from "@/hooks/useApi";

interface Props {
  bookId: string;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteBookModal({ bookId, onClose, onDeleted }: Props) {
  const { apiFetch } = useApi();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

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

  return (
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
        <p className="mb-5 text-center text-sm text-gray-600">
          Книга опиниться у видалених книгах наприкінці списку ваших книг. Ви зможете відновити її будь-якої миті.
        </p>
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
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useApi } from "../../hooks/useApi";

interface Props {
  bookId: string;
  onUnpublished?: () => void;
}

export function UnpublishButton({ bookId, onUnpublished }: Props) {
  const { apiFetch } = useApi();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
              <p className="mb-5 text-center text-sm text-gray-600">
                Книга зникне з магазину Ulit і буде знята з зовнішніх майданчиків. Файли й ISBN
                збережуться — книга лишиться у вашому кабінеті, і ви зможете опублікувати її знову
                будь-якої миті.
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

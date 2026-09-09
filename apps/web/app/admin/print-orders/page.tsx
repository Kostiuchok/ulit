"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useApi } from "../../../hooks/useApi";
import { useRefetchOnFocus } from "../../../hooks/useRefetchOnFocus";

interface PrintOrderItem {
  id: string;
  format: "PRINT_SOFTCOVER" | "PRINT_HARDCOVER" | "PRINT_SOFTCOVER_BW" | "PRINT_HARDCOVER_BW";
  price: string;
  order: { id: string; createdAt: string; status: string; user: { name: string; email: string } };
  book: {
    id: string;
    title: string;
    coverUrl?: string | null;
    printPdfUrl?: string | null;
    printPdfGeneratedAt?: string | null;
    printCurvesUrl?: string | null;
    printCurvesGeneratedAt?: string | null;
    author: { name: string };
  };
}

const FORMAT_LABELS: Record<PrintOrderItem["format"], string> = {
  PRINT_SOFTCOVER: "М'яка, кольоровий",
  PRINT_HARDCOVER: "Тверда, кольоровий",
  PRINT_SOFTCOVER_BW: "М'яка, ч/б",
  PRINT_HARDCOVER_BW: "Тверда, ч/б",
};

type CurvesStatus =
  | { status: "IDLE" }
  | { status: "PROCESSING"; progress: number }
  | { status: "DONE"; printCurvesUrl: string }
  | { status: "ERROR"; message: string };

export default function PrintOrdersPage() {
  const { apiFetch, token } = useApi();
  const [items, setItems] = useState<PrintOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  // Keyed by bookId -- curves are per-book (same file whichever order/format
  // pulled it up), not per order-item, so two order rows for the same book
  // share one export/poll.
  const [curves, setCurves] = useState<Record<string, CurvesStatus>>({});
  const pollRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const load = useCallback(
    (opts?: { silent?: boolean }) => {
      if (!token) return;
      if (!opts?.silent) setLoading(true);
      return apiFetch<{ items: PrintOrderItem[] }>("/api/admin/print-orders")
        .then((d) => setItems(d.items))
        .finally(() => { if (!opts?.silent) setLoading(false); });
    },
    [token, apiFetch]
  );

  useEffect(() => { load(); }, [load]);
  useRefetchOnFocus(useCallback(() => load({ silent: true }), [load]));

  useEffect(() => () => {
    Object.values(pollRefs.current).forEach(clearInterval);
  }, []);

  const pollCurves = useCallback(
    async (bookId: string) => {
      try {
        const res = await apiFetch<
          { status: "NO_PRINT_PDF" } | { status: "PROCESSING"; progress: number } | { status: "DONE"; printCurvesUrl: string }
        >(`/api/admin/books/${bookId}/print-curves`);
        if (res.status === "NO_PRINT_PDF") {
          setCurves((prev) => ({ ...prev, [bookId]: { status: "ERROR", message: "Автор ще не згенерував друкований PDF" } }));
          if (pollRefs.current[bookId]) { clearInterval(pollRefs.current[bookId]); delete pollRefs.current[bookId]; }
          return;
        }
        setCurves((prev) => ({ ...prev, [bookId]: res }));
        if (res.status === "DONE" && pollRefs.current[bookId]) {
          clearInterval(pollRefs.current[bookId]);
          delete pollRefs.current[bookId];
        }
      } catch (e: any) {
        setCurves((prev) => ({ ...prev, [bookId]: { status: "ERROR", message: e.message || "Не вдалося сформувати файл у кривих" } }));
        if (pollRefs.current[bookId]) { clearInterval(pollRefs.current[bookId]); delete pollRefs.current[bookId]; }
      }
    },
    [apiFetch]
  );

  function startExport(bookId: string) {
    if (pollRefs.current[bookId]) return; // already polling
    setCurves((prev) => ({ ...prev, [bookId]: { status: "PROCESSING", progress: 0 } }));
    pollCurves(bookId);
    pollRefs.current[bookId] = setInterval(() => pollCurves(bookId), 3000);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Друковані замовлення</h1>
        <p className="text-sm text-gray-500 mt-1">
          Книги, куплені у друкованому форматі. Файл у кривих (векторні контури замість вбудованого шрифту)
          формується тут на вимогу — окремо від друкованого PDF автора, який лишається зі шрифтом для власного
          перегляду й заявки на УДК.
        </p>
      </div>

      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 animate-pulse">Завантаження…</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-4xl mb-3">🖨️</p>
            <p className="text-gray-500">Ще немає жодного друкованого замовлення</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Книга</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Покупець</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Формат</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Ціна</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Дата</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Друкарня</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => {
                const c = curves[item.book.id] ?? { status: "IDLE" as const };
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {item.book.coverUrl ? (
                          <img src={item.book.coverUrl} alt="" className="h-10 w-7 rounded object-cover" />
                        ) : (
                          <div className="h-10 w-7 rounded bg-gray-100 flex items-center justify-center text-sm">📖</div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900">{item.book.title}</p>
                          <p className="text-xs text-gray-500">{item.book.author.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700">{item.order.user.name}</p>
                      <p className="text-xs text-gray-400">{item.order.user.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{FORMAT_LABELS[item.format]}</td>
                    <td className="px-4 py-3 text-gray-600">{item.price} ₴</td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(item.order.createdAt).toLocaleDateString("uk-UA")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.status === "DONE" ? (
                        <a
                          href={c.printCurvesUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex rounded-md bg-green-50 border border-green-200 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100"
                        >
                          ⬇ Завантажити (криві)
                        </a>
                      ) : c.status === "PROCESSING" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700">
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-300 border-t-blue-700" />
                          Формуємо… {c.progress > 0 ? `${c.progress}%` : ""}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startExport(item.book.id)}
                          title="Конвертує друкований PDF автора в криві (без вбудованого шрифту) для передачі в друкарню -- може зайняти кілька хвилин, файл вийде значно більшим за оригінал"
                          className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
                        >
                          Експортувати книжку для типографії в кривих
                        </button>
                      )}
                      {c.status === "ERROR" && <p className="mt-1 text-xs text-red-600">{c.message}</p>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

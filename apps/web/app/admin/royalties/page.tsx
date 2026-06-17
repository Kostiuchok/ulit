"use client";

import { useEffect, useState } from "react";
import { useApi } from "../../../hooks/useApi";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const PAYOUT_THRESHOLD = 500;

interface Royalty {
  id: string;
  amount: string;
  source: string;
  status: string;
  createdAt: string;
  paidAt?: string | null;
  author: { id: string; name: string; email: string };
  book: { id: string; title: string; isbn?: string | null };
}

export default function RoyaltiesPage() {
  const { apiFetch, token } = useApi();
  const [royalties, setRoyalties] = useState<Royalty[]>([]);
  const [pendingByAuthor, setPendingByAuthor] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);
  const [filter, setFilter] = useState("PENDING");

  const fetchRoyalties = async () => {
    if (!token) return;
    setLoading(true);
    const params = filter ? `?status=${filter}` : "";
    try {
      const data = await apiFetch<{ royalties: Royalty[]; pendingByAuthor: Record<string, number> }>(
        `/api/admin/royalties${params}`
      );
      setRoyalties(data.royalties);
      setPendingByAuthor(data.pendingByAuthor);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRoyalties(); }, [token, filter]);

  async function handlePay(id: string) {
    setPaying(id);
    try {
      await apiFetch(`/api/admin/royalties/${id}/pay`, { method: "POST" });
      await fetchRoyalties();
    } finally {
      setPaying(null);
    }
  }

  const totalPending = Object.values(pendingByAuthor).reduce((s, v) => s + v, 0);
  const authorsAboveThreshold = Object.entries(pendingByAuthor).filter(([, v]) => v >= PAYOUT_THRESHOLD);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Роялті</h1>
          <p className="text-sm text-gray-500 mt-1">Виплати авторам за продажі на платформі</p>
        </div>
        <a
          href={`${API_URL}/api/admin/royalties/export`}
          className="rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm"
        >
          ⬇ CSV
        </a>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Очікують виплати</p>
          <p className="text-2xl font-bold text-orange-600">{totalPending.toFixed(2)} грн</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Авторів понад {PAYOUT_THRESHOLD} грн</p>
          <p className="text-2xl font-bold text-red-600">{authorsAboveThreshold.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">Готові до виплати</p>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Поріг виплати</p>
          <p className="text-2xl font-bold text-gray-900">{PAYOUT_THRESHOLD} грн</p>
        </div>
      </div>

      {/* Authors above threshold */}
      {authorsAboveThreshold.length > 0 && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
          <p className="text-sm font-semibold text-orange-800 mb-2">
            ⚠️ {authorsAboveThreshold.length} авторів очікують виплату ({PAYOUT_THRESHOLD}+ грн):
          </p>
          <div className="flex flex-wrap gap-2">
            {authorsAboveThreshold.map(([authorId, amount]) => {
              const r = royalties.find((r) => r.author.id === authorId);
              return r ? (
                <span key={authorId} className="rounded-full bg-orange-100 border border-orange-200 px-3 py-1 text-xs font-medium text-orange-800">
                  {r.author.name}: {amount.toFixed(2)} грн
                </span>
              ) : null;
            })}
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        {["PENDING", "PAID", ""].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === s ? "bg-gray-900 text-white" : "border bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {s || "Всі"}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 animate-pulse">Завантаження…</div>
        ) : royalties.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Записів немає</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Автор</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Книга</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Сума</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Джерело</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Статус</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Дія</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {royalties.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{r.author.name}</p>
                    <p className="text-xs text-gray-500">{r.author.email}</p>
                    {pendingByAuthor[r.author.id] >= PAYOUT_THRESHOLD && r.status === "PENDING" && (
                      <span className="text-xs text-orange-600 font-medium">
                        💰 {pendingByAuthor[r.author.id].toFixed(0)} грн pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-900 truncate max-w-[180px]">{r.book.title}</p>
                    {r.book.isbn && <p className="text-xs font-mono text-gray-400">{r.book.isbn}</p>}
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900">
                    {Number(r.amount).toFixed(2)} грн
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                      {r.source}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      r.status === "PAID"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {r.status === "PAID" ? "✓ Виплачено" : "Очікує"}
                    </span>
                    {r.paidAt && (
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(r.paidAt).toLocaleDateString("uk-UA")}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.status === "PENDING" && (
                      <button
                        onClick={() => handlePay(r.id)}
                        disabled={paying === r.id}
                        className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        {paying === r.id ? "…" : "Виплатити"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

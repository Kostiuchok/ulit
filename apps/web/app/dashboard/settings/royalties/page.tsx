"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useApi } from "../../../../hooks/useApi";

interface Royalty {
  id: string;
  amount: number;
  source: string;
  status: "PENDING" | "PAID";
  paidAt: string | null;
  createdAt: string;
  book: { id: string; title: string };
}

interface RoyaltiesResponse {
  summary: { earned: number; paid: number; pending: number };
  royalties: Royalty[];
}

function fmt(amount: number) {
  return `${amount.toLocaleString("uk-UA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₴`;
}

function fmtDate(date: string) {
  return new Date(date).toLocaleDateString("uk-UA");
}

export default function RoyaltiesPage() {
  const { apiFetch, token } = useApi();
  const [data, setData] = useState<RoyaltiesResponse | null>(null);
  const [identityConfirmed, setIdentityConfirmed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      apiFetch<RoyaltiesResponse>("/api/royalties/me"),
      apiFetch<{ user: { contractAcceptedAt: string | null } }>("/api/users/me"),
    ])
      .then(([royalties, me]) => {
        setData(royalties);
        setIdentityConfirmed(!!me.user.contractAcceptedAt);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return <div className="p-8 animate-pulse text-gray-400">Завантаження…</div>;
  }
  if (!data) return null;

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold text-gray-900">Авторські відрахування</h1>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border bg-white p-6 shadow-sm space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Сума до виплати</p>
            <p className="text-2xl font-bold" style={{ color: "#ff5900" }}>{fmt(data.summary.pending)}</p>
            <p className="text-sm text-gray-500">
              Виведення авторських відрахувань займає <span className="font-semibold text-gray-700">до 30 робочих днів</span>.
            </p>
            {!identityConfirmed && (
              <Link
                href="/dashboard/settings/contract"
                className="inline-block rounded-lg px-5 py-2.5 text-sm font-semibold text-white"
                style={{ backgroundColor: "#ff5900" }}
              >
                Підтвердити особу
              </Link>
            )}
          </div>

          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-4">Статистика виплат</p>
            <dl className="space-y-3">
              <div className="flex items-center justify-between border-b pb-3 text-sm">
                <dt className="text-gray-500">Зароблено за весь час</dt>
                <dd className="font-semibold" style={{ color: "#ff5900" }}>{fmt(data.summary.earned)}</dd>
              </div>
              <div className="flex items-center justify-between border-b pb-3 text-sm">
                <dt className="text-gray-500">Виведено</dt>
                <dd className="font-semibold text-gray-900">{fmt(data.summary.paid)}</dd>
              </div>
              <div className="flex items-center justify-between text-sm">
                <dt className="text-gray-500">Залишок</dt>
                <dd className="font-semibold" style={{ color: "#ff5900" }}>{fmt(data.summary.pending)}</dd>
              </div>
            </dl>
          </div>
        </div>

        {data.royalties.length > 0 && (
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Книга</th>
                  <th className="text-left px-4 py-3 font-semibold">Джерело</th>
                  <th className="text-left px-4 py-3 font-semibold">Дата</th>
                  <th className="text-left px-4 py-3 font-semibold">Статус</th>
                  <th className="text-right px-4 py-3 font-semibold">Сума</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.royalties.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 text-gray-900">{r.book.title}</td>
                    <td className="px-4 py-3 text-gray-500">{r.source}</td>
                    <td className="px-4 py-3 text-gray-500">{fmtDate(r.paidAt ?? r.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.status === "PAID" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {r.status === "PAID" ? "Виплачено" : "Очікує"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{fmt(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useApi } from "../../../hooks/useApi";

interface Stats {
  books: Record<string, number>;
  orders: Record<string, number>;
  revenue: number;
  pendingRoyalties: number;
  recentReview: any[];
}

function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className={`rounded-xl border bg-white p-5 shadow-sm`}>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-3xl font-extrabold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Чернетка",
  PROCESSING: "Обробка",
  REVIEW: "На перевірці",
  PUBLISHED: "Опубліковано",
  ARCHIVED: "Архів",
};

export default function AdminDashboard() {
  const { apiFetch, token } = useApi();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    apiFetch<Stats>("/api/admin/stats")
      .then(setStats)
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const books = stats?.books ?? {};
  const orders = stats?.orders ?? {};

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Загальна статистика платформи</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Всього книг" value={books.total ?? 0} color="text-gray-900" />
        <KpiCard
          label="На перевірці"
          value={books.REVIEW ?? 0}
          color="text-yellow-600"
          sub={books.REVIEW ? "Потребують модерації" : "Все оброблено"}
        />
        <KpiCard
          label="Оплачено замовлень"
          value={orders.PAID ?? 0}
          color="text-green-600"
          sub={`Всього: ${orders.total ?? 0}`}
        />
        <KpiCard
          label="Виторг"
          value={`${(stats?.revenue ?? 0).toFixed(0)} грн`}
          color="text-blue-600"
        />
        <KpiCard
          label="Опубліковано"
          value={books.PUBLISHED ?? 0}
          color="text-green-700"
        />
        <KpiCard
          label="В обробці"
          value={books.PROCESSING ?? 0}
          color="text-blue-700"
        />
        <KpiCard
          label="Очікують виплати"
          value={`${(stats?.pendingRoyalties ?? 0).toFixed(0)} грн`}
          color="text-orange-600"
          sub="Роялті авторів"
        />
        <KpiCard
          label="Чернеток"
          value={books.DRAFT ?? 0}
          color="text-gray-600"
        />
      </div>

      {/* Books by status */}
      <div className="rounded-xl border bg-white shadow-sm p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Статуси книг</h2>
        <div className="flex flex-wrap gap-3">
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <Link
              key={key}
              href={`/admin/books?status=${key}`}
              className="flex items-center gap-2 rounded-lg border px-4 py-2 hover:bg-gray-50 transition-colors"
            >
              <span className="text-lg font-bold text-gray-900">{books[key] ?? 0}</span>
              <span className="text-sm text-gray-500">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent books under review */}
      {(stats?.recentReview?.length ?? 0) > 0 && (
        <div className="rounded-xl border bg-white shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">На перевірці</h2>
            <Link href="/admin/books?status=REVIEW" className="text-sm text-gray-500 hover:text-gray-900">
              Всі →
            </Link>
          </div>
          <div className="space-y-3">
            {stats!.recentReview.map((book: any) => (
              <div key={book.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-3">
                  {book.coverUrl ? (
                    <img src={book.coverUrl} alt="" className="h-10 w-7 rounded object-cover" />
                  ) : (
                    <div className="h-10 w-7 rounded bg-gray-100 flex items-center justify-center text-sm">📖</div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900">{book.title}</p>
                    <p className="text-xs text-gray-500">{book.author.name}</p>
                  </div>
                </div>
                <Link
                  href={`/admin/books?id=${book.id}`}
                  className="rounded-md bg-yellow-50 border border-yellow-200 px-3 py-1 text-xs font-medium text-yellow-800 hover:bg-yellow-100"
                >
                  Переглянути
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { href: "/admin/books?status=REVIEW", label: "Модерація книг", icon: "✅", color: "border-yellow-200 bg-yellow-50" },
          { href: "/admin/distribution/queue", label: "Черга дистрибуції", icon: "📦", color: "border-blue-200 bg-blue-50" },
          { href: "/admin/royalties?status=PENDING", label: "Виплати роялті", icon: "💰", color: "border-green-200 bg-green-50" },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-xl border p-5 hover:shadow-md transition-shadow ${link.color}`}
          >
            <p className="text-3xl mb-2">{link.icon}</p>
            <p className="text-sm font-semibold text-gray-900">{link.label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useApi } from "../../../../hooks/useApi";
import { cn } from "../../../../lib/utils";

interface OrderItemView {
  bookId: string;
  format: "EBOOK" | "PRINT_SOFTCOVER" | "PRINT_HARDCOVER";
  price: number;
  book: { title: string; slug: string; coverUrl: string | null };
}

interface OrderView {
  id: string;
  total: number;
  status: string;
  createdAt: string;
  items: OrderItemView[];
}

interface OrdersResponse {
  orders: OrderView[];
  downloads: Record<string, { label: string; url: string }[]>;
}

const FILTERS = [
  { key: "ALL", label: "Усі книги" },
  { key: "PRINT", label: "Друковані" },
  { key: "EBOOK", label: "Електронні" },
] as const;

function matchesFilter(format: OrderItemView["format"], filter: (typeof FILTERS)[number]["key"]) {
  if (filter === "ALL") return true;
  if (filter === "EBOOK") return format === "EBOOK";
  return format === "PRINT_SOFTCOVER" || format === "PRINT_HARDCOVER";
}

function fmtDate(date: string) {
  return new Date(date).toLocaleDateString("uk-UA");
}

export default function PurchasesPage() {
  const { apiFetch, token } = useApi();
  const [data, setData] = useState<OrdersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("ALL");

  useEffect(() => {
    if (!token) return;
    apiFetch<OrdersResponse>("/api/orders")
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const purchasedItems = useMemo(() => {
    if (!data) return [];
    return data.orders
      .filter((o) => o.status === "PAID" || o.status === "FULFILLED")
      .flatMap((o) => o.items.map((i) => ({ ...i, orderId: o.id, purchasedAt: o.createdAt })))
      .filter((i) => matchesFilter(i.format, filter));
  }, [data, filter]);

  if (loading) {
    return <div className="p-8 animate-pulse text-gray-400">Завантаження…</div>;
  }
  if (!data) return null;

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="rounded-xl p-6" style={{ backgroundColor: "#ff5900" }}>
          <h1 className="text-2xl font-bold text-white">Мої покупки</h1>
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-lg border px-4 py-1.5 text-sm font-medium transition-colors",
                filter === f.key ? "text-white border-transparent" : "text-gray-600 border-gray-300 hover:border-gray-400"
              )}
              style={filter === f.key ? { backgroundColor: "#ff5900" } : undefined}
            >
              {f.label}
            </button>
          ))}
        </div>

        {purchasedItems.length === 0 ? (
          <p className="text-sm text-gray-400">Тут з&rsquo;являться книги, які ви придбали.</p>
        ) : (
          <div className="space-y-4">
            {purchasedItems.map((item, i) => {
              const links = data.downloads[item.bookId] ?? [];
              return (
                <div key={`${item.orderId}-${i}`} className="rounded-xl border bg-white p-5 shadow-sm flex flex-col sm:flex-row gap-5">
                  {item.book.coverUrl ? (
                    <img src={item.book.coverUrl} alt="" className="h-32 w-24 shrink-0 rounded object-cover" />
                  ) : (
                    <div className="h-32 w-24 shrink-0 rounded bg-gray-100" />
                  )}
                  <div className="flex-1 space-y-2">
                    <p className="font-semibold text-gray-900">{item.book.title}</p>
                    <p className="text-xs text-gray-400">Дата покупки книги: {fmtDate(item.purchasedAt)}</p>
                    {links.length > 0 ? (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {links.map((link) => (
                          <a
                            key={link.label}
                            href={link.url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-gray-400"
                          >
                            {link.label}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">Файли для завантаження недоступні для цього формату.</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

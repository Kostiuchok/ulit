"use client";

import { useEffect, useMemo, useState } from "react";
import { useApi } from "../../../../hooks/useApi";
import { cn } from "../../../../lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface OrderItemView {
  bookId: string;
  format: "EBOOK" | "PRINT_SOFTCOVER" | "PRINT_HARDCOVER" | "PRINT_SOFTCOVER_BW" | "PRINT_HARDCOVER_BW";
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
  return format !== "EBOOK";
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
    return (
      <div className="p-8">
        <div className="max-w-5xl mx-auto animate-pulse text-center text-gray-400">Завантаження…</div>
      </div>
    );
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
            <Button
              key={f.key}
              size="sm"
              variant={filter === f.key ? "default" : "outline"}
              onClick={() => setFilter(f.key)}
              className={cn("rounded-lg", filter === f.key && "border-transparent text-white")}
              style={filter === f.key ? { backgroundColor: "#ff5900" } : undefined}
            >
              {f.label}
            </Button>
          ))}
        </div>

        {purchasedItems.length === 0 ? (
          <p className="text-sm text-gray-400">Тут з&rsquo;являться книги, які ви придбали.</p>
        ) : (
          <div className="space-y-4">
            {purchasedItems.map((item, i) => {
              const links = data.downloads[item.bookId] ?? [];
              return (
                <Card key={`${item.orderId}-${i}`} className="shadow-sm">
                  <CardContent className="flex flex-col gap-5 p-5 sm:flex-row">
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
                            <Button key={link.label} asChild variant="outline" size="sm" className="text-xs font-semibold">
                              <a href={link.url} target="_blank" rel="noreferrer">
                                {link.label}
                              </a>
                            </Button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">Файли для завантаження недоступні для цього формату.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

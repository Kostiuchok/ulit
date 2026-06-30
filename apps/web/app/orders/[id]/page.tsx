"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useApi } from "../../../hooks/useApi";

interface DownloadLink {
  label: string;
  url: string;
}

interface OrderItem {
  bookId: string;
  format: string;
  price: number;
  book: {
    title: string;
    slug: string;
    coverUrl: string | null;
  };
}

interface Order {
  id: string;
  total: number;
  status: string;
  createdAt: string;
  items: OrderItem[];
}

const STATUS_INFO: Record<string, { label: string; icon: string; className: string }> = {
  PENDING: {
    label: "Очікує оплати",
    icon: "⏳",
    className: "bg-yellow-50 border-yellow-200 text-yellow-800",
  },
  PAID: {
    label: "Оплачено",
    icon: "✅",
    className: "bg-green-50 border-green-200 text-green-800",
  },
  FULFILLED: {
    label: "Виконано",
    icon: "✅",
    className: "bg-green-50 border-green-200 text-green-800",
  },
  CANCELLED: {
    label: "Скасовано",
    icon: "❌",
    className: "bg-red-50 border-red-200 text-red-800",
  },
};

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const { apiFetch, token } = useApi();
  const [order, setOrder] = useState<Order | null>(null);
  const [downloads, setDownloads] = useState<Record<string, DownloadLink[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchOrder = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<{ order: Order; downloads: Record<string, DownloadLink[]> }>(
        `/api/orders/${id}`
      );
      setOrder(data.order);
      setDownloads(data.downloads);
    } catch (e: any) {
      setError(e.message || "Помилка завантаження замовлення");
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // Poll every 5s while order is PENDING (waiting for LiqPay callback)
  useEffect(() => {
    if (!order || order.status !== "PENDING") return;
    const interval = setInterval(fetchOrder, 5000);
    return () => clearInterval(interval);
  }, [order?.status, fetchOrder]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl p-8 space-y-4">
        <div className="h-8 w-48 bg-gray-200 animate-pulse rounded" />
        <div className="h-64 bg-gray-200 animate-pulse rounded-xl" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center">
        <p className="text-red-600">{error || "Замовлення не знайдено"}</p>
        <Link href="/" className="mt-4 inline-block text-sm text-gray-500 underline">
          На головну
        </Link>
      </div>
    );
  }

  const statusInfo = STATUS_INFO[order.status] ?? STATUS_INFO.PENDING;
  const isPaid = order.status === "PAID" || order.status === "FULFILLED";

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      {/* Status banner */}
      <div className={`mb-8 rounded-xl border p-5 ${statusInfo.className}`}>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{statusInfo.icon}</span>
          <div>
            <p className="font-semibold text-lg">{statusInfo.label}</p>
            {order.status === "PENDING" && (
              <p className="text-sm opacity-80 mt-0.5">
                Очікуємо підтвердження від платіжної системи…
                <span className="ml-2 inline-block animate-pulse">🔄</span>
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white shadow-sm p-6 space-y-6">
        {/* Order header */}
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <p className="text-xs text-gray-500">Замовлення</p>
            <p className="font-mono text-sm text-gray-900">{order.id.slice(0, 16)}…</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Сума</p>
            <p className="text-xl font-bold text-gray-900">{Number(order.total).toFixed(2)} грн</p>
          </div>
        </div>

        {/* Items */}
        <div className="space-y-4">
          {order.items.map((item) => (
            <div key={`${item.bookId}-${item.format}`} className="flex items-start gap-4">
              {item.book.coverUrl ? (
                <img
                  src={item.book.coverUrl}
                  alt={item.book.title}
                  className="h-20 w-14 rounded-md object-cover shadow-sm shrink-0"
                />
              ) : (
                <div className="flex h-20 w-14 items-center justify-center rounded-md bg-gray-100 text-2xl shrink-0">
                  📖
                </div>
              )}

              <div className="flex-1">
                <p className="font-semibold text-gray-900">{item.book.title}</p>
                <p className="text-sm text-gray-500">
                  {item.format === "EBOOK" ? "Електронна книга (EPUB + FB2 + MOBI)" : "Друкована версія (PDF)"}
                </p>
                <p className="text-sm font-medium text-gray-900 mt-1">{Number(item.price).toFixed(2)} грн</p>

                {/* Download links */}
                {isPaid && downloads[item.bookId] && downloads[item.bookId].length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="rounded-md bg-amber-50 border border-amber-300 px-3 py-2 text-xs text-amber-900 font-medium">
                      ⏳ Посилання дійсні <strong>48 годин</strong> — завантажте файли зараз і збережіть на пристрій.
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {downloads[item.bookId].map((link) => (
                        <a
                          key={link.label}
                          href={link.url}
                          download
                          className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 transition-colors"
                        >
                          ⬇ {link.label}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {isPaid && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
            Не можете завантажити зараз? Поверніться на цю сторінку або скористайтесь посиланнями з email — вони теж дійсні 48 годин.
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-6 flex flex-wrap gap-3 justify-center">
        <Link
          href="/books"
          className="rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Продовжити покупки
        </Link>
        {isPaid && (
          <button
            onClick={fetchOrder}
            className="rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Оновити посилання
          </button>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCartStore } from "@/lib/cartStore";

export default function CartPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const removeItem = useCartStore((s) => s.removeItem);
  const clear = useCartStore((s) => s.clear);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");

  const total = items.reduce((sum, i) => sum + i.price, 0);

  async function handleCheckout() {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/cart");
      return;
    }

    setPlacing(true);
    setError("");
    try {
      const token = (session as any)?.apiToken as string | undefined;
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          items: items.map((i) => ({ bookId: i.bookId, format: i.format, formats: i.formats })),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Помилка створення замовлення");
        return;
      }

      const { order, liqpay } = await res.json();
      sessionStorage.setItem(
        `checkout_${order.id}`,
        JSON.stringify({ data: liqpay.data, signature: liqpay.signature, action_url: liqpay.action_url })
      );
      clear();
      router.push(`/checkout/${order.id}`);
    } catch {
      setError("Помилка з'єднання");
    } finally {
      setPlacing(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16 text-center">
        <div className="text-5xl mb-4">🛒</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Кошик порожній</h1>
        <p className="text-sm text-gray-500 mb-6">Додайте книги з каталогу, щоб оформити замовлення.</p>
        <Link
          href="/books"
          className="inline-block rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-700"
        >
          Перейти в каталог
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
      <h1 className="text-2xl font-bold text-gray-900">Кошик</h1>
      <p className="mt-1 text-sm text-gray-500">
        {items.length} {items.length === 1 ? "товар" : "товари"} в кошику
      </p>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <div
              key={`${item.bookId}-${item.format}`}
              className="flex gap-4 rounded-xl border bg-white p-4 shadow-sm"
            >
              {item.coverUrl ? (
                <img
                  src={item.coverUrl}
                  alt={item.title}
                  className="h-28 w-20 shrink-0 rounded-md object-cover"
                />
              ) : (
                <div className="flex h-28 w-20 shrink-0 items-center justify-center rounded-md bg-gray-100 text-2xl">
                  📖
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{item.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.author}</p>
                <p className="text-xs text-gray-500 mt-1">{item.formatLabel}</p>
              </div>

              <div className="flex flex-col items-end justify-between shrink-0">
                <p className="font-bold text-gray-900">{item.price.toFixed(2)} грн</p>
                <button
                  onClick={() => removeItem(item.bookId, item.format)}
                  className="text-xs font-medium text-red-600 hover:text-red-700"
                >
                  Видалити
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-20 rounded-xl border bg-white p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-gray-900">Разом</h2>

            <div className="space-y-1.5 text-sm">
              {items.map((item) => (
                <div key={`${item.bookId}-${item.format}`} className="flex justify-between gap-2">
                  <span className="text-gray-500 truncate">{item.title}</span>
                  <span className="text-gray-900 shrink-0">{item.price.toFixed(2)} грн</span>
                </div>
              ))}
            </div>

            <div className="border-t pt-3 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900">До сплати</span>
              <span className="text-xl font-black text-gray-900">{total.toFixed(2)} грн</span>
            </div>

            <div className="border-t pt-3 space-y-2">
              <p className="text-sm font-medium text-gray-900">Спосіб оплати</p>
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 flex items-center gap-3">
                <div className="h-5 w-5 rounded-full border-4 border-green-600 bg-white" />
                <div>
                  <p className="text-sm font-bold text-gray-900">LiqPay</p>
                  <p className="text-[11px] text-gray-500">Приват24, Монобанк, Visa/MC</p>
                </div>
              </div>
              <div className="rounded-lg border p-3 flex items-center gap-3 opacity-50">
                <div className="h-5 w-5 rounded-full border border-gray-400 bg-white" />
                <div>
                  <p className="text-sm font-bold text-gray-900">WayForPay</p>
                  <p className="text-[11px] text-gray-500">Незабаром — стане способом оплати за замовчуванням</p>
                </div>
              </div>
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <button
              onClick={handleCheckout}
              disabled={placing || status === "loading"}
              className="w-full rounded-lg bg-gray-900 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {placing ? "Оформлення…" : "Оформити замовлення"}
            </button>

            <p className="text-[11px] text-gray-400">
              Після оплати посилання на завантаження файлів будуть доступні 48 годин.
            </p>

            <Link href="/books" className="block text-center text-xs text-gray-500 hover:text-gray-900">
              ← Продовжити покупки
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

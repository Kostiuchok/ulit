"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Props {
  bookId: string;
  format: "EBOOK" | "PRINT";
  price: number;
  label: string;
  variant?: "primary" | "outline";
}

export function BuyButton({ bookId, format, price, label, variant = "primary" }: Props) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const baseClass = "w-full rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-50";
  const variantClass =
    variant === "primary"
      ? "bg-gray-900 text-white hover:bg-gray-700"
      : "border border-gray-900 text-gray-900 hover:bg-gray-50";

  async function handleBuy() {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=" + encodeURIComponent(window.location.pathname));
      return;
    }

    setLoading(true);
    setError("");

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const token = (session as any)?.apiToken as string | undefined;

      const res = await fetch(`${apiUrl}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ items: [{ bookId, format }] }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Помилка створення замовлення");
        return;
      }

      const { order, liqpay } = await res.json();

      // Store LiqPay form data in sessionStorage, then navigate to checkout
      sessionStorage.setItem(
        `checkout_${order.id}`,
        JSON.stringify({ data: liqpay.data, signature: liqpay.signature, action_url: liqpay.action_url })
      );
      router.push(`/checkout/${order.id}`);
    } catch {
      setError("Помилка з'єднання");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1">
      <button
        onClick={handleBuy}
        disabled={loading || status === "loading"}
        className={`${baseClass} ${variantClass}`}
      >
        {loading ? "Завантаження…" : `${label} · ${price.toFixed(2)} грн`}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useCartStore, type CartFormat } from "@/lib/cartStore";

interface Props {
  bookId: string;
  format: CartFormat;
  price: number;
  title: string;
  author: string;
  coverUrl?: string | null;
  formatLabel: string;
  label: string;
  variant?: "primary" | "outline";
}

export function AddToCartButton({
  bookId,
  format,
  price,
  title,
  author,
  coverUrl,
  formatLabel,
  label,
  variant = "primary",
}: Props) {
  const addItem = useCartStore((s) => s.addItem);
  const inCart = useCartStore((s) => s.items.some((i) => i.bookId === bookId && i.format === format));

  const baseClass = "w-full rounded-lg py-2.5 text-sm font-semibold transition-colors";
  const variantClass =
    variant === "primary"
      ? "bg-gray-900 text-white hover:bg-gray-700"
      : "border border-gray-900 text-gray-900 hover:bg-gray-50";

  if (inCart) {
    return (
      <div className="space-y-1.5">
        <div className={`${baseClass} border border-green-600 bg-green-50 text-center text-green-700`}>
          ✓ У кошику
        </div>
        <Link href="/cart" className="block text-center text-xs text-gray-500 hover:text-gray-900 underline">
          Перейти в кошик
        </Link>
      </div>
    );
  }

  return (
    <button
      onClick={() => addItem({ bookId, format, title, author, coverUrl, formatLabel, price })}
      className={`${baseClass} ${variantClass}`}
    >
      {label} · {price.toFixed(2)} грн
    </button>
  );
}

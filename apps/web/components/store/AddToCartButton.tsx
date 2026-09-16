"use client";

import Link from "next/link";
import { useCartStore, type CartFormat } from "@/lib/cartStore";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  formats?: string[];
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
  formats,
}: Props) {
  const addItem = useCartStore((s) => s.addItem);
  const inCart = useCartStore((s) => s.items.some((i) => i.bookId === bookId && i.format === format));

  if (inCart) {
    return (
      <div className="space-y-1.5">
        <Button
          disabled
          className="w-full border border-green-600 bg-green-50 text-green-700 hover:bg-green-50 disabled:opacity-100"
        >
          ✓ У кошику
        </Button>
        <Button asChild variant="link" className="w-full text-xs text-gray-500 hover:text-gray-900">
          <Link href="/cart">Перейти в кошик</Link>
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant={variant === "primary" ? "default" : "outline"}
      onClick={() => addItem({ bookId, format, title, author, coverUrl, formatLabel, price, formats })}
      className={cn(
        "w-full",
        variant === "primary" ? "bg-gray-900 hover:bg-gray-700" : "border-gray-900 text-gray-900 hover:bg-gray-50"
      )}
    >
      {label} · {price.toFixed(2)} грн
    </Button>
  );
}

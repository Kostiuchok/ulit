"use client";

import Link from "next/link";
import { useCartStore } from "@/lib/cartStore";

export function CartIcon() {
  const count = useCartStore((s) => s.items.length);

  return (
    <Link
      href="/cart"
      className="relative inline-flex items-center justify-center p-2 text-gray-600 hover:text-gray-900"
      aria-label="Кошик"
    >
      🛒
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gray-900 px-1 text-[10px] font-bold text-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}

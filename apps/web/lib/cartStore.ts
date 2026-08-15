import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartFormat =
  | "EBOOK"
  | "PRINT_SOFTCOVER"
  | "PRINT_HARDCOVER"
  | "PRINT_SOFTCOVER_BW"
  | "PRINT_HARDCOVER_BW";

export interface CartItem {
  bookId: string;
  format: CartFormat;
  title: string;
  author: string;
  coverUrl?: string | null;
  formatLabel: string;
  price: number;
}

interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (bookId: string, format: CartFormat) => void;
  clear: () => void;
}

function sameLine(a: { bookId: string; format: CartFormat }, bookId: string, format: CartFormat) {
  return a.bookId === bookId && a.format === format;
}

// Client-side only cart — no server persistence. The checkout step still
// creates a real Order via the existing POST /api/orders (which already
// accepts a full items[] array), so nothing here needs to be durable beyond
// the buyer's own browser between adding items and checking out.
export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) =>
        set((state) => ({
          items: [...state.items.filter((i) => !sameLine(i, item.bookId, item.format)), item],
        })),
      removeItem: (bookId, format) =>
        set((state) => ({ items: state.items.filter((i) => !sameLine(i, bookId, format)) })),
      clear: () => set({ items: [] }),
    }),
    { name: "ulit-cart" }
  )
);

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCreateBook } from "@/components/books/CreateBookProvider";

// No page of its own any more (the creation wizard that lived here is gone):
// this address only opens the "Нова книга" dialog over «Мої книги». Kept for
// bookmarks, the store's "Опублікувати книгу" button and links opened in a
// new tab.
export default function NewBookPage() {
  const router = useRouter();
  const { open } = useCreateBook();

  useEffect(() => {
    open();
    router.replace("/dashboard/books");
  }, [open, router]);

  return null;
}

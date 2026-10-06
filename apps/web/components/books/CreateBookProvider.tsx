"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import Link from "next/link";
import { CreateBookDialog } from "@/components/books/CreateBookDialog";

// Where a "create a book" link points. The page behind it only opens this
// same dialog -- it exists for bookmarks, the store's "Опублікувати книгу"
// button and "open in a new tab".
export const CREATE_BOOK_HREF = "/dashboard/books/new";

interface CreateBookContextValue {
  open: () => void;
}

const CreateBookContext = createContext<CreateBookContextValue | null>(null);

// One "Створити книжку" dialog for the whole author cabinet (mounted in
// app/dashboard/layout.tsx), so every button opens the very same thing
// without leaving the page the author is on.
export function CreateBookProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  // Stable on purpose: a fresh object every render re-renders every consumer
  // (CLAUDE.md журнал #39 -- that is how the save bar once starved navigation).
  const value = useMemo(() => ({ open }), [open]);

  return (
    <CreateBookContext.Provider value={value}>
      {children}
      <CreateBookDialog open={isOpen} onOpenChange={setIsOpen} />
    </CreateBookContext.Provider>
  );
}

export function useCreateBook(): CreateBookContextValue {
  const ctx = useContext(CreateBookContext);
  if (!ctx) throw new Error("useCreateBook must be used inside CreateBookProvider");
  return ctx;
}

// A real link (so "open in a new tab" works) that opens the dialog in place
// on a plain click. Deliberately still an <a href>: on a page with unsaved
// edits UnsavedChangesGuard catches the click first (capture phase) and asks
// before anything else happens -- a bare <button> would slip past it and the
// navigation after creating the book would drop those edits silently.
export function CreateBookLink({
  children,
  ...rest
}: Omit<React.ComponentPropsWithoutRef<typeof Link>, "href">) {
  const { open } = useCreateBook();
  return (
    <Link
      {...rest}
      href={CREATE_BOOK_HREF}
      onClick={(e) => {
        rest.onClick?.(e);
        if (e.defaultPrevented) return;
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        open();
      }}
    >
      {children}
    </Link>
  );
}

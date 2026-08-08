"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { BOOK_STATUS_LABELS } from "@/lib/bookStatus";
import { cn } from "@/lib/utils";

interface SidebarBook {
  id: string;
  title: string;
  coverUrl?: string | null;
  status: string;
}

type SubNavItem =
  | { label: string; href: (bookId: string) => string; disabled?: false }
  | { label: string; disabled: true };

const EDIT_GROUP: SubNavItem[] = [
  { label: "Рукопис", href: (id) => `/dashboard/books/${id}/manuscript` },
  { label: "Обкладинка", href: (id) => `/dashboard/books/${id}/cover` },
  { label: "Передперегляд", href: (id) => `/dashboard/books/${id}/preview` },
];

const STORE_GROUP: SubNavItem[] = [
  { label: "Вихідні дані", href: (id) => `/dashboard/books/${id}/output-data` },
  { label: "Публікація у магазинах", href: (id) => `/dashboard/books/${id}/publish` },
  { label: "Статистика", disabled: true },
  { label: "Знайти нових читачів", disabled: true },
  { label: "Включити акцію на книгу", disabled: true },
];

function NavLink({ item, bookId, pathname }: { item: SubNavItem; bookId: string; pathname: string }) {
  if (item.disabled) {
    return (
      <div
        title="Функція в розробці"
        className="flex items-center justify-between rounded-md px-3 py-1.5 text-xs text-gray-300 cursor-not-allowed"
      >
        <span>{item.label}</span>
        <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-400">скоро</span>
      </div>
    );
  }
  const href = item.href(bookId);
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-md px-3 py-1.5 text-xs transition-colors",
        active ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
      )}
    >
      {item.label}
    </Link>
  );
}

export function AuthorBooksSidebar() {
  const { apiFetch, token } = useApi();
  const pathname = usePathname();
  const { id: routeId } = useParams<{ id?: string }>();
  const [books, setBooks] = useState<SidebarBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBookId, setExpandedBookId] = useState<string | null>(routeId ?? null);

  useEffect(() => {
    if (!token) return;
    apiFetch<{ books: SidebarBook[] }>("/api/books")
      .then(({ books }) => setBooks(books))
      .catch((e) => console.error("[AuthorBooksSidebar] failed to load:", e))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (routeId) setExpandedBookId(routeId);
  }, [routeId]);

  return (
    <aside className="w-72 shrink-0 border-r bg-white sticky top-0 h-screen overflow-y-auto">
      {loading ? (
        <div className="p-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : books.length === 0 ? (
        <div className="p-4 text-sm text-gray-400">Ще немає книг</div>
      ) : (
        <div>
          {books.map((book) => {
            const status = BOOK_STATUS_LABELS[book.status] ?? BOOK_STATUS_LABELS.DRAFT;
            const isExpanded = expandedBookId === book.id;
            return (
              <div key={book.id} className="border-b">
                <div
                  className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedBookId((prev) => (prev === book.id ? null : book.id))}
                >
                  {book.coverUrl ? (
                    <img src={book.coverUrl} alt="" className="h-10 w-8 shrink-0 rounded-sm object-cover" />
                  ) : (
                    <div className="flex h-10 w-8 shrink-0 items-center justify-center rounded-sm bg-gray-100 text-sm">
                      📖
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/dashboard/books/${book.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="block truncate text-sm font-semibold text-gray-900 hover:underline"
                    >
                      {book.title}
                    </Link>
                    <p className="text-xs text-gray-400">{status.label}</p>
                  </div>
                </div>

                {isExpanded && (
                  <nav className="space-y-0.5 px-2 pb-3">
                    <NavLink item={{ label: "Замовити тираж", disabled: true }} bookId={book.id} pathname={pathname} />
                    <NavLink item={{ label: "Обговорення книги", disabled: true }} bookId={book.id} pathname={pathname} />
                    <NavLink
                      item={{ label: "Завантажити файли", href: (id) => `/dashboard/books/${id}/published` }}
                      bookId={book.id}
                      pathname={pathname}
                    />

                    <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                      ⌃ Редагувати книгу
                    </p>
                    {EDIT_GROUP.map((item) => (
                      <NavLink key={item.label} item={item} bookId={book.id} pathname={pathname} />
                    ))}

                    <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                      ⌃ Ваша книга у магазинах
                    </p>
                    {STORE_GROUP.map((item) => (
                      <NavLink key={item.label} item={item} bookId={book.id} pathname={pathname} />
                    ))}
                  </nav>
                )}
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
